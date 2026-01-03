import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { query } from './helpers/dynamo-helpers/query'
import { Email } from './helpers/parse-email'
import { generateAttachmentUrls } from './helpers/s3-presigned-url'
import { getAuthenticatedRecipient } from './middleware/auth-middleware'

const s3Client = new S3Client({ region: process.env.REGION })

interface GetEmailRequest {
  s3Key: string
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
    const validRecipients = authResult.recipients

    const bucketName = process.env.S3_BUCKET_NAME
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set')
    }

    // Get s3_key from query parameters or body
    let s3Key: string | undefined

    if (event.queryStringParameters?.s3_key) {
      s3Key = event.queryStringParameters.s3_key
    } else if (event.body) {

      const body: GetEmailRequest = JSON.parse(event.body)
      s3Key = body.s3Key
    }

    if (!s3Key) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 's3_key is required (as query param or in body)' }),
      }
    }

    console.log(`Fetching email from s3://${bucketName}/${s3Key}`)

    // Fetch the email from S3
    const getObjectResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })
    )

    const emailContent = await getObjectResponse.Body?.transformToString()
    if (!emailContent) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Email not found' }),
      }
    }

    // Parse the email
    const email = JSON.parse(emailContent) as Email

    // Validate that the authenticated user is either the recipient or sender
    if (validRecipients.indexOf(email.recipient) === -1 && validRecipients.indexOf(email.sender) === -1) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden - You can only access your own emails' }),
      }
    }

    // Generate presigned URLs for the main email's attachments
    if (email.attachment_keys && email.attachment_keys.length > 0) {
      email.attachments = await generateAttachmentUrls(bucketName, email.attachment_keys)
    }

    // Fetch thread relations if the email has a thread_id
    let threadEmails: Email[] = []
    if (email.thread_id) {
      try {
        const tableName = process.env.DYNAMODB_TABLE_NAME
        const threadRelationsTableName = `${tableName?.replace('-emails', '')}-thread-relations`

        // Query thread_relations table to get all emails in the thread for this recipient
        const threadRelationsResult = await query<Email>({
          tableName: threadRelationsTableName,
          keyConditionExpression: 'thread_id = :threadId',
          filterExpression: 'recipient = :recipient',
          expressionAttributeValues: {
            ':threadId': email.thread_id,
            ':recipient': email.recipient,
          },
        })

        threadEmails = threadRelationsResult.items || []

        // Sort emails by timestamp (chronological order)
        threadEmails.sort((a, b) => {
          const timestampA = a.timestamp.split('#')[0]
          const timestampB = b.timestamp.split('#')[0]
          return timestampA.localeCompare(timestampB)
        })

        // Generate presigned URLs for all thread emails' attachments
        await Promise.all(
          threadEmails.map(async (threadEmail) => {
            if (threadEmail.attachment_keys && threadEmail.attachment_keys.length > 0) {
              threadEmail.attachments = await generateAttachmentUrls(bucketName, threadEmail.attachment_keys)
            }
          })
        )
      } catch (error) {
        console.error('Error fetching thread relations:', error)
        // Continue without thread info if fetch fails
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...email,
        threadEmails,
      }),
    }
  } catch (error) {
    console.error('Error fetching email:', error)

    // Handle specific S3 errors
    if (error instanceof Error) {
      if (error.name === 'NoSuchKey') {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Email not found' }),
        }
      }
      if (error.name === 'AccessDenied') {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Access denied' }),
        }
      }
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch email' }),
    }
  }
}
