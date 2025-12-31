import { CognitoJwtVerifier } from 'aws-jwt-verify'
import {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEventV2,
  Context,
} from 'aws-lambda'

const userPoolId = process.env.COGNITO_USER_POOL_ID
const clientId = process.env.COGNITO_CLIENT_ID

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
 * Lambda Authorizer for API Gateway HTTP API (v2)
 *
 * Extracts AccessToken from cookies, validates it against Cognito,
 * and returns an IAM policy allowing/denying access.
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2,
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

    // Phone number is added to token by pre-token-generation trigger
    const phoneNumber = payload.phone_number as string | undefined

    if (!phoneNumber) {
      console.error('No phone_number claim in token for user:', payload.sub)
      throw new Error('Unauthorized - No phone number in token')
    }

    console.log('Phone number from token:', phoneNumber)

    // Generate wildcard resource to allow all routes in the API
    // routeArn format: arn:aws:execute-api:region:account:apiId/stage/method/path
    // We'll replace the method/path with */* to allow all routes
    const arnParts = event.routeArn.split('/')
    const wildcardArn = `${arnParts[0]}/${arnParts[1]}/*/*`

    console.log('Original routeArn:', event.routeArn)
    console.log('Wildcard resource:', wildcardArn)

    // Generate IAM policy - use wildcard to allow all routes
    const policy = generatePolicy(
      payload.sub, // Use subject as principalId
      'Allow',
      wildcardArn,
      {
        phone_number: phoneNumber,
        sub: payload.sub,
        username: payload.username,
      }
    )

    console.log('Returning policy with context:', JSON.stringify(policy.context, null, 2))

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
