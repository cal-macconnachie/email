import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { batchGet } from './helpers/dynamo-helpers/batch-get'
import { query } from './helpers/dynamo-helpers/query'
import { Email } from './helpers/parse-email'
import { generateAttachmentUrls } from './helpers/s3-presigned-url'
import { getAuthenticatedRecipient } from './middleware/auth-middleware'

const s3Client = new S3Client({ region: process.env.REGION })

interface ThreadRelation {
  thread_id: string
  timestamp: string
  message_id: string
  recipient: string
  subject: string
  email_recipient: string // The actual recipient in the emails table
}

interface GetThreadEmailsResponse {
  thread_id: string
  emails: Email[]
  count: number
}

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Authenticate and get recipient from phone→email mapping
    const authResult = await getAuthenticatedRecipient(event)
    if (!authResult.success) {
      return {
        statusCode: authResult.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: authResult.error }),
      }
    }
    const recipient = authResult.recipient

    const bucketName = process.env.S3_BUCKET_NAME
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set')
    }

    const tableName = process.env.DYNAMODB_TABLE_NAME
    if (!tableName) {
      throw new Error('DYNAMODB_TABLE_NAME environment variable is not set')
    }

    const threadRelationsTableName = `${process.env.DYNAMODB_TABLE_NAME?.replace('-emails', '')}-thread-relations`

    // Parse query parameters
    const threadId = event.queryStringParameters?.thread_id
    const includeBody = event.queryStringParameters?.include_body === 'true'

    // Validate required parameters
    if (!threadId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'thread_id is required query parameter',
        }),
      }
    }

    // Query thread_relations table to get all emails in the thread for this recipient
    const threadRelationsResult = await query<ThreadRelation>({
      tableName: threadRelationsTableName,
      keyConditionExpression: 'thread_id = :threadId',
      filterExpression: 'recipient = :recipient',
      expressionAttributeValues: {
        ':threadId': threadId,
        ':recipient': recipient,
      },
    })

    if (!threadRelationsResult.items || threadRelationsResult.items.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thread_id: threadId,
          emails: [],
          count: 0,
        } as GetThreadEmailsResponse),
      }
    }

    // Fetch email metadata from emails table using batch get
    // Use email_recipient field (stores the actual emails table recipient)
    const emailKeys = threadRelationsResult.items.map((item) => ({
      recipient: item.email_recipient,
      timestamp: item.timestamp,
    }))

    const emailMetadataList = await batchGet<Email>({
      tableName,
      keys: emailKeys,
    })

    // If include_body is true, fetch full email content from S3
    const emails: Email[] = []
    for (const metadata of emailMetadataList) {
      let email = metadata

      if (includeBody && metadata.s3_key) {
        try {
          const s3Response = await s3Client.send(
            new GetObjectCommand({
              Bucket: bucketName,
              Key: metadata.s3_key,
            })
          )

          const emailJson = await s3Response.Body?.transformToString()
          if (emailJson) {
            const fullEmail = JSON.parse(emailJson) as Email
            email = fullEmail
          }
        } catch (error) {
          console.error(`Error fetching email body from S3 for key ${metadata.s3_key}:`, error)
          // Continue with metadata only if S3 fetch fails
        }
      }

      // Generate presigned URLs for attachments
      if (email.attachment_keys && email.attachment_keys.length > 0) {
        email.attachments = await generateAttachmentUrls(bucketName, email.attachment_keys)
      }

      emails.push(email)
    }

    // Sort emails by timestamp (chronological order)
    emails.sort((a, b) => {
      const timestampA = a.timestamp.split('#')[0]
      const timestampB = b.timestamp.split('#')[0]
      return timestampA.localeCompare(timestampB)
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        thread_id: threadId,
        emails,
        count: emails.length,
      } as GetThreadEmailsResponse),
    }
  } catch (error) {
    console.error('Error fetching thread emails:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to fetch thread emails',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
