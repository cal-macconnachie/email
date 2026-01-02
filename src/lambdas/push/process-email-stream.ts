import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { DynamoDBStreamEvent } from 'aws-lambda'
import * as webpush from 'web-push'
import { query } from '../helpers/dynamo-helpers/query'
import { update } from '../helpers/dynamo-helpers/update'
import { getVapidKeys } from '../helpers/push/get-vapid-keys'

interface EmailRecord {
  recipient: string
  sender: string
  subject: string
  s3_key: string
  timestamp: string
}

interface PushSubscription {
  phone_number: string
  subscription_id: string
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  status: string
}

/**
 * Process Email Stream Events
 *
 * Triggered by DynamoDB Streams when new emails are inserted into the emails table.
 * Looks up the recipient's push subscriptions and sends Web Push notifications.
 *
 * Flow:
 * 1. Filter INSERT events from stream
 * 2. Extract recipient email address
 * 3. Look up phone_number from email_prefix via EmailPrefixIndex GSI
 * 4. Query active push subscriptions for that phone_number
 * 5. Send Web Push notification to each subscription
 * 6. Handle errors and mark expired subscriptions
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  console.log(`Processing ${event.Records.length} stream records`)

  // Get table names from environment
  const pushSubscriptionsTable = process.env.PUSH_SUBSCRIPTIONS_TABLE
  const phoneEmailRelationsTable = process.env.PHONE_EMAIL_RELATIONS_TABLE

  if (!pushSubscriptionsTable || !phoneEmailRelationsTable) {
    throw new Error('Required environment variables not set')
  }

  // Load VAPID keys from SSM
  let vapidKeys
  try {
    vapidKeys = await getVapidKeys()
  } catch (error) {
    console.error('Failed to load VAPID keys:', error)
    throw error
  }

  // Filter for INSERT events only (new emails)
  const newEmails = event.Records.filter((record) => record.eventName === 'INSERT')
    .map((record) => {
      if (!record.dynamodb?.NewImage) return null
      return unmarshall(record.dynamodb.NewImage as unknown as Record<string, AttributeValue>) as EmailRecord
    })
    .filter((email): email is EmailRecord => email !== null)

  console.log(`Found ${newEmails.length} new emails`)

  // Process each new email
  for (const email of newEmails) {
    try {
      await processNewEmail(email, phoneEmailRelationsTable, pushSubscriptionsTable, vapidKeys)
    } catch (error) {
      console.error(`Error processing email ${email.s3_key}:`, error)
      // Continue processing other emails even if one fails
    }
  }
}

async function processNewEmail(
  email: EmailRecord,
  phoneEmailRelationsTable: string,
  pushSubscriptionsTable: string,
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
): Promise<void> {
  console.log(`Processing email: ${email.recipient} <- ${email.sender}`)

  // Extract email prefix from recipient
  const emailPrefix = email.recipient.split('@')[0]
  if (!emailPrefix) {
    console.warn(`Invalid recipient email format: ${email.recipient}`)
    return
  }

  // Look up phone number from email prefix using EmailPrefixIndex GSI
  const phoneMappingResults = await query<{ phone_number: string; email_prefix: string }>({
    tableName: phoneEmailRelationsTable,
    indexName: 'EmailPrefixIndex',
    keyConditionExpression: 'email_prefix = :prefix',
    expressionAttributeValues: {
      ':prefix': emailPrefix,
    },
  })

  if (!phoneMappingResults.items || phoneMappingResults.items.length === 0) {
    console.warn(`No phone mapping found for email prefix: ${emailPrefix}`)
    return
  }

  const phoneNumber = phoneMappingResults.items[0].phone_number
  console.log(`Found phone mapping: ${emailPrefix} -> ${phoneNumber}`)

  // Query active subscriptions for this user using StatusIndex GSI
  const subscriptionResults = await query<PushSubscription>({
    tableName: pushSubscriptionsTable,
    indexName: 'StatusIndex',
    keyConditionExpression: 'phone_number = :phone AND #status = :status',
    expressionAttributeNames: {
      '#status': 'status',
    },
    expressionAttributeValues: {
      ':phone': phoneNumber,
      ':status': 'active',
    },
  })

  if (!subscriptionResults.items || subscriptionResults.items.length === 0) {
    console.log(`No active subscriptions found for ${phoneNumber}`)
    return
  }

  console.log(`Found ${subscriptionResults.items.length} active subscription(s) for ${phoneNumber}`)

  // Prepare notification payload
  const notificationPayload = {
    title: `New email from ${email.sender}`,
    body: email.subject || '(No subject)',
    icon: './direct-market.svg',
    badge: './direct-market.svg',
    tag: email.s3_key, // Prevents duplicate notifications
    data: {
      url: `/emails/${encodeURIComponent(email.s3_key)}`,
      s3_key: email.s3_key,
      timestamp: email.timestamp,
      recipient: email.recipient,
    },
    requireInteraction: false,
  }

  // Send push notification to each subscription
  const sendResults = await Promise.allSettled(
    subscriptionResults.items.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          },
          JSON.stringify(notificationPayload),
          {
            vapidDetails: {
              subject: vapidKeys.subject,
              publicKey: vapidKeys.publicKey,
              privateKey: vapidKeys.privateKey,
            },
            TTL: 86400, // 24 hours
          }
        )

        console.log(`Push sent successfully to subscription ${subscription.subscription_id}`)

        // Update last_used timestamp
        await update({
          tableName: pushSubscriptionsTable,
          key: {
            phone_number: phoneNumber,
            subscription_id: subscription.subscription_id,
          },
          updates: {
            last_used: new Date().toISOString(),
          },
        })
      } catch (error: unknown) {
        // Handle subscription errors
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as { statusCode: number }).statusCode

          // 410 Gone or 404 Not Found = subscription no longer valid
          if (statusCode === 410 || statusCode === 404) {
            console.log(`Subscription expired (${statusCode}): ${subscription.subscription_id}`)
            await update({
              tableName: pushSubscriptionsTable,
              key: {
                phone_number: phoneNumber,
                subscription_id: subscription.subscription_id,
              },
              updates: {
                status: 'expired',
              },
            })
            return
          }
        }

        console.error(`Push failed for subscription ${subscription.subscription_id}:`, error)
        throw error
      }
    })
  )

  // Log results
  const successCount = sendResults.filter((r) => r.status === 'fulfilled').length
  const failureCount = sendResults.filter((r) => r.status === 'rejected').length
  console.log(
    `Push notifications sent: ${successCount} succeeded, ${failureCount} failed (out of ${sendResults.length} total)`
  )
}
