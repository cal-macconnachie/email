import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { update } from './helpers/dynamo-helpers/update'
import { Email } from './helpers/parse-email'

const s3Client = new S3Client({ region: process.env.REGION })

interface UpdateEmailRequest {
  recipient: string
  timestamp: string
  read?: boolean
  archived?: boolean
}

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
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
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const request = JSON.parse(event.body) as UpdateEmailRequest
    const { recipient, timestamp, read, archived } = request

    // Validate required fields
    if (!recipient || !timestamp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'recipient and timestamp are required' }),
      }
    }

    // Validate at least one field to update
    if (read === undefined && archived === undefined) {
      return {
        statusCode: 400,
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
        'Access-Control-Allow-Origin': '*',
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
      body: JSON.stringify({
        error: 'Failed to update email',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
