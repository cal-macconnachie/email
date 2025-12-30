import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { v4 } from 'uuid'

const s3Client = new S3Client({ region: process.env.REGION })

interface PresignRequest {
  filename: string
  contentType: string
  userId: string
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
    const bucketName = process.env.S3_BUCKET_NAME
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set')
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const { filename, contentType, userId } = JSON.parse(event.body) as PresignRequest

    // Validate inputs
    if (!filename || !contentType || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'filename, contentType, and userId are required' }),
      }
    }

    // Generate unique attachment ID
    const attachmentId = v4()

    // Store pending attachments in a temporary location
    const attachmentKey = `attachments/pending/${userId}/${attachmentId}/${filename}`

    // Create presigned URL for upload (valid for 15 minutes)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: attachmentKey,
      ContentType: contentType,
      Metadata: {
        'user-id': userId,
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
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    }
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate upload URL' }),
    }
  }
}
