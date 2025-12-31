import { APIGatewayProxyEvent } from 'aws-lambda'
import { get } from '../helpers/dynamo-helpers/get'

interface AuthResult {
  success: true
  recipient: string
  phoneNumber: string
}

interface AuthError {
  success: false
  statusCode: number
  error: string
}

/**
 * Authentication Middleware
 *
 * Extracts phone number from JWT claims, looks up email mapping in DynamoDB,
 * and returns the recipient email address.
 *
 * This middleware is used by all protected Lambda functions to:
 * 1. Authenticate the user (via API Gateway JWT authorizer)
 * 2. Look up their email address from phone_email_relations table
 * 3. Auto-inject the recipient parameter
 * 4. Return 403 if no mapping exists
 */
export async function getAuthenticatedRecipient(
  event: APIGatewayProxyEvent
): Promise<AuthResult | AuthError> {
  try {
    // Extract JWT claims from API Gateway authorizer context
    const claims = event.requestContext?.authorizer?.jwt?.claims

    if (!claims) {
      console.error('No JWT claims found in request context')
      return {
        success: false,
        statusCode: 401,
        error: 'Unauthorized - No authentication token',
      }
    }

    // Extract phone number from JWT claims
    const phoneNumber = claims.phone_number as string | undefined

    if (!phoneNumber) {
      console.error('No phone_number in JWT claims')
      return {
        success: false,
        statusCode: 401,
        error: 'Unauthorized - Invalid token',
      }
    }

    console.log(`Authenticated user: ${phoneNumber}`)

    // Get table name from environment
    const tableName = process.env.PHONE_EMAIL_RELATIONS_TABLE

    if (!tableName) {
      throw new Error('PHONE_EMAIL_RELATIONS_TABLE environment variable not set')
    }

    // Look up email mapping
    const mapping = await get<{ phone_number: string; email_prefix: string }>({
      tableName,
      key: { phone_number: phoneNumber },
    })

    // If no mapping exists, return 403
    if (!mapping || !mapping.email_prefix) {
      console.error(`No email mapping found for phone number: ${phoneNumber}`)
      return {
        success: false,
        statusCode: 403,
        error: 'Forbidden - No email account associated with this phone number',
      }
    }

    // Construct recipient email
    const recipient = `${mapping.email_prefix}@macconnachie.com`

    console.log(`Mapped ${phoneNumber} → ${recipient}`)

    return {
      success: true,
      recipient,
      phoneNumber,
    }
  } catch (error) {
    console.error('Error in auth middleware:', error)
    return {
      success: false,
      statusCode: 500,
      error: 'Internal server error during authentication',
    }
  }
}
