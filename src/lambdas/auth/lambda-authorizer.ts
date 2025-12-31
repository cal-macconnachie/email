import {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  Context,
} from 'aws-lambda'
import { CognitoJwtVerifier } from 'aws-jwt-verify'

const userPoolId = process.env.COGNITO_USER_POOL_ID
const clientId = process.env.COGNITO_CLIENT_ID
const region = process.env.REGION || 'us-east-1'

if (!userPoolId || !clientId) {
  throw new Error('Cognito configuration missing')
}

// Create JWT verifier for AccessToken
const verifier = CognitoJwtVerifier.create({
  userPoolId,
  clientId,
  tokenUse: 'access',
})

/**
 * Lambda Authorizer for API Gateway
 *
 * Extracts AccessToken from cookies, validates it against Cognito,
 * and returns an IAM policy allowing/denying access.
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
  _context: Context
): Promise<APIGatewayAuthorizerResult> => {
  try {
    console.log('Authorizer event:', JSON.stringify(event, null, 2))

    // Extract cookies from headers
    const cookies = event.headers?.cookie || event.headers?.Cookie || ''

    if (!cookies) {
      console.error('No cookies found in request')
      throw new Error('Unauthorized')
    }

    // Parse AccessToken from cookies
    const accessTokenMatch = cookies.match(/AccessToken=([^;]+)/)

    if (!accessTokenMatch || !accessTokenMatch[1]) {
      console.error('No AccessToken found in cookies')
      throw new Error('Unauthorized')
    }

    const token = accessTokenMatch[1]

    // Verify JWT token with Cognito
    const payload = await verifier.verify(token)

    console.log('Token verified successfully:', payload.sub)

    // Generate IAM policy
    const policy = generatePolicy(
      payload.sub, // Use subject as principalId
      'Allow',
      event.methodArn,
      {
        phone_number: payload.phone_number as string,
        sub: payload.sub,
        username: payload.username as string,
      }
    )

    return policy
  } catch (error) {
    console.error('Authorization failed:', error)

    // Return deny policy
    throw new Error('Unauthorized')
  }
}

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string>
): APIGatewayAuthorizerResult {
  const policy: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  }

  return policy
}
