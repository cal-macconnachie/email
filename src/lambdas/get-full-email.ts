import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { Email } from './helpers/parse-email'

const s3Client = new S3Client({ region: process.env.REGION })

interface GetEmailRequest {
  s3Key: string
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

    // Parse and return the email
    const email = JSON.parse(emailContent) as Email

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(email),
    }
  } catch (error) {
    console.error('Error fetching email:', error)

    // Handle specific S3 errors
    if (error instanceof Error) {
      if (error.name === 'NoSuchKey') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Email not found' }),
        }
      }
      if (error.name === 'AccessDenied') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Access denied' }),
        }
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch email' }),
    }
  }
}
