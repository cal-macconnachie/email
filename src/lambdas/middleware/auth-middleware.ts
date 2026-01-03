import { APIGatewayProxyEvent } from 'aws-lambda'
import { queryAll } from '../helpers/dynamo-helpers/query'

interface AuthResult {
  success: true
  recipients: string[]
  defaultRecipient: string
  phoneNumber: string
}

interface AuthError {
  success: false
  statusCode: number
  error: string
}

type AuthResponse = AuthResult | AuthError

const cachedResults: Record<string, AuthResponse> = {}

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
): Promise<AuthResponse> {
  try {
    // Extract claims from Lambda authorizer context
    // Lambda authorizer puts context in event.requestContext.authorizer.lambda
    const authorizer = event.requestContext?.authorizer
    const context = authorizer?.lambda || authorizer

    if (!context) {
      console.error('No authorizer context found in request')
      return {
        success: false,
        statusCode: 401,
        error: 'Unauthorized - No authentication token',
      }
    }

    // Extract phone number from authorizer context
    const phoneNumber = context.phone_number as string | undefined

    if (!phoneNumber) {
      console.error('No phone_number in authorizer context')
      return {
        success: false,
        statusCode: 401,
        error: 'Unauthorized - Invalid token',
      }
    }
    if (cachedResults[phoneNumber]) {
      return cachedResults[phoneNumber]
    }

    console.log(`Authenticated user: ${phoneNumber}`)

    // Get table name from environment
    const tableName = process.env.PHONE_EMAIL_RELATIONS_TABLE

    if (!tableName) {
      throw new Error('PHONE_EMAIL_RELATIONS_TABLE environment variable not set')
    }

    // Look up email mapping
    const mappings = await queryAll<{ phone_number: string; email_prefix: string; is_default?: boolean }>({
      tableName,
      keyConditionExpression: 'phone_number = :phone',
      expressionAttributeValues: {
        ':phone': phoneNumber,
      },
    })

    // If no mapping exists, return 403
    if (!mappings || mappings.length === 0) {
      console.error(`No email mapping found for phone number: ${phoneNumber}`)
      cachedResults[phoneNumber] = {
        success: false,
        statusCode: 403,
        error: 'Forbidden - No email account associated with this phone number',
      }
      return cachedResults[phoneNumber]
    }

    // Construct recipient email
    const recipients = mappings.map(mapping => `${mapping.email_prefix}@macconnachie.com`)
    const defaultMapping = mappings.find(mapping => mapping.is_default)
    const defaultRecipient = defaultMapping ? `${defaultMapping.email_prefix}@macconnachie.com` : recipients[0]

    const result: AuthResult = {
      success: true,
      recipients,
      defaultRecipient,
      phoneNumber,
    }
    cachedResults[phoneNumber] = result

    return result
  } catch (error) {
    console.error('Error in auth middleware:', error)
    return {
      success: false,
      statusCode: 500,
      error: 'Internal server error during authentication',
    }
  }
}
