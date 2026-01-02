import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { deleteItem } from '../helpers/dynamo-helpers/delete'
import { getAuthenticatedRecipient } from '../middleware/auth-middleware'

interface UnsubscribeRequest {
  subscription_id: string
}

/**
 * Unsubscribe from Push Notifications
 *
 * Removes a push notification subscription for the authenticated user.
 * This is called when the user revokes notification permission or logs out.
 *
 * Route: POST /api/push/unsubscribe (protected)
 *
 * Request Body:
 * {
 *   subscription_id: string  // UUID of the subscription to remove
 * }
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Authenticate and get phone number
    const authResult = await getAuthenticatedRecipient(event)
    if (!authResult.success) {
      return {
        statusCode: authResult.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: authResult.error }),
      }
    }

    const phoneNumber = authResult.phoneNumber

    // Get table name from environment
    const tableName = process.env.PUSH_SUBSCRIPTIONS_TABLE
    if (!tableName) {
      throw new Error('PUSH_SUBSCRIPTIONS_TABLE environment variable is not set')
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const request = JSON.parse(event.body) as UnsubscribeRequest

    // Validate required fields
    if (!request.subscription_id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'subscription_id is required' }),
      }
    }

    // Delete subscription from DynamoDB
    await deleteItem({
      tableName,
      key: {
        phone_number: phoneNumber,
        subscription_id: request.subscription_id,
      },
    })

    console.log(`Push subscription removed: ${phoneNumber} / ${request.subscription_id}`)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Push subscription removed successfully',
        subscription_id: request.subscription_id,
      }),
    }
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to unsubscribe from push notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
