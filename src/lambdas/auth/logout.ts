import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

/**
 * Logout - Clear session cookies
 *
 * This Lambda clears the HTTP-only cookies to log the user out.
 * Optionally, could revoke refresh token in Cognito for enhanced security.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Logout event:', JSON.stringify(event, null, 2))

    // Extract user info from JWT claims (if available) for logging
    const phoneNumber = event.requestContext?.authorizer?.jwt?.claims?.phone_number

    if (phoneNumber) {
      console.log(`User ${phoneNumber} logging out`)
    }

    // Clear cookies by setting Max-Age=0
    const cookieOptions = 'HttpOnly; Secure; SameSite=Lax; Path=/; Domain=macconnachie.com; Max-Age=0'
    const clearAccessToken = `AccessToken=; ${cookieOptions}`
    const clearIdToken = `IdToken=; ${cookieOptions}`
    const clearRefreshToken = `RefreshToken=; ${cookieOptions}`

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearAccessToken,
      },
      multiValueHeaders: {
        'Set-Cookie': [clearAccessToken, clearIdToken, clearRefreshToken],
      },
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
