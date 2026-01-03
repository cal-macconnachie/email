import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { v4 } from 'uuid'
import { getAuthenticatedRecipient } from './middleware/auth-middleware'

const s3Client = new S3Client({ region: process.env.REGION })

interface PresignRequest {
  filename: string
  contentType: string
}

interface PresignResponse {
  uploadUrl: string
  attachmentKey: string
  attachmentId: string
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
    const recipient = authResult.defaultRecipient

    const bucketName = process.env.S3_BUCKET_NAME
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set')
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const { filename, contentType } = JSON.parse(event.body) as PresignRequest

    // Validate inputs
    if (!filename || !contentType) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'filename and contentType are required' }),
      }
    }

    // Generate unique attachment ID
    const attachmentId = v4()

    // Sanitize recipient for use in S3 key
    const sanitizedRecipient = recipient.toLowerCase().replace(/[^a-z0-9@._-]/g, '_')

    // Store pending attachments in a temporary location
    const attachmentKey = `attachments/pending/${sanitizedRecipient}/${attachmentId}/${filename}`

    // Create presigned URL for upload (valid for 15 minutes)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: attachmentKey,
      ContentType: contentType,
      Metadata: {
        'recipient': recipient,
        'attachment-id': attachmentId,
        'original-filename': filename,
      },
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 })

    const response: PresignResponse = {
      uploadUrl,
      attachmentKey,
      attachmentId,
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    }
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate upload URL' }),
    }
  }
}
