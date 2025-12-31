import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { update } from './helpers/dynamo-helpers/update'
import { Email } from './helpers/parse-email'
import { getAuthenticatedRecipient } from './middleware/auth-middleware'

const s3Client = new S3Client({ region: process.env.REGION })

interface UpdateEmailRequest {
  timestamp: string
  read?: boolean
  archived?: boolean
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

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const request = JSON.parse(event.body) as UpdateEmailRequest
    const { timestamp, read, archived } = request

    // Validate required fields
    if (!timestamp) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'timestamp is required' }),
      }
    }

    // Validate at least one field to update
    if (read === undefined && archived === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'At least one of read or archived must be provided' }),
      }
    }

    // Build updates object
    const updates: { read?: boolean; archived?: boolean } = {}
    if (read !== undefined) {
      updates.read = read
    }
    if (archived !== undefined) {
      updates.archived = archived
    }

    // Update DynamoDB
    await update({
      tableName,
      key: {
        recipient,
        timestamp,
      },
      updates,
    })

    // Also update the S3 JSON file to keep it in sync
    // First, get the s3_key from DynamoDB response or construct it
    // We need to get the email record to get the s3_key
    const updatedEmail = await update<{ s3_key: string; read?: boolean; archived?: boolean }>({
      tableName,
      key: {
        recipient,
        timestamp,
      },
      updates,
      returnUpdated: true,
    })

    if (updatedEmail.s3_key) {
      // Fetch the email JSON from S3
      const getResponse = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: updatedEmail.s3_key,
        })
      )

      const emailContent = await getResponse.Body?.transformToString()
      if (emailContent) {
        const email: Email = JSON.parse(emailContent)

        // Update the read/archived fields
        if (read !== undefined) {
          email.read = read
        }
        if (archived !== undefined) {
          email.archived = archived
        }

        // Write back to S3
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: updatedEmail.s3_key,
            Body: JSON.stringify(email),
            ContentType: 'application/json',
          })
        )
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Email updated successfully',
        updated: updates,
      }),
    }
  } catch (error) {
    console.error('Error updating email:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to update email',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
