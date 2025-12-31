import { CognitoIdentityProviderClient, RevokeTokenCommand } from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2, Context } from 'aws-lambda'

/**
 * Logout - Clear session cookies
 *
 * This Lambda clears the HTTP-only cookies to log the user out.
 * Optionally, could revoke refresh token in Cognito for enhanced security.
 */
export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  _context: Context
): Promise<APIGatewayProxyResultV2> => {
  try {
    console.log('Logout event:', JSON.stringify(event, null, 2))

    // Extract user info from JWT claims (if available) for logging
    const phoneNumber = event.requestContext.authorizer.jwt.claims.phone_number as string | undefined

    if (phoneNumber) {
      console.log(`User ${phoneNumber} logging out`)
    }

    // Clear cookies by setting Max-Age=0
    const cookieOptions = 'HttpOnly; Secure; SameSite=Lax; Path=/; Domain=macconnachie.com; Max-Age=0'
    const clearAccessToken = `AccessToken=; ${cookieOptions}`
    const clearIdToken = `IdToken=; ${cookieOptions}`
    const clearRefreshToken = `RefreshToken=; ${cookieOptions}`

    // revoke tokens in cognito
    const command = new RevokeTokenCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Token: event.cookies?.find((cookie) => cookie.startsWith('RefreshToken='))?.split('=')[1] || '',
    })
    const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION })
    await cognitoClient.send(command)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      cookies: [clearAccessToken, clearIdToken, clearRefreshToken],
      body: JSON.stringify({
        message: 'Logged out successfully',
      }),
    }
  } catch (error) {
    console.error('Error during logout:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to logout',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
