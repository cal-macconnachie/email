import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { query } from './helpers/dynamo-helpers/query'
import { getAuthenticatedRecipient } from './middleware/auth-middleware'

interface ListEmailsRequest {
  sender?: string
  startDate?: string // ISO timestamp or partial like "2025-01"
  endDate?: string // ISO timestamp or partial like "2025-12"
  limit?: number
  lastEvaluatedKey?: Record<string, unknown>
  sortOrder?: 'ASC' | 'DESC'
  mailbox?: 'inbox' | 'sent' | 'archived'
}

interface EmailMetadata {
  id: string
  recipient: string
  sender: string
  recipient_sender: string
  subject: string
  cc?: string[]
  bcc?: string[]
  reply_to?: string[]
  s3_key: string
  attachment_keys?: string[]
  timestamp: string
  created_at: string
  read: boolean
  archived: boolean
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
    const recipient = authResult.recipient

    const tableName = process.env.DYNAMODB_TABLE_NAME
    if (!tableName) {
      throw new Error('DYNAMODB_TABLE_NAME environment variable is not set')
    }

    // Parse request - can come from query params or body
    let request: ListEmailsRequest

    if (event.queryStringParameters) {
      request = {
        sender: event.queryStringParameters.sender,
        startDate: event.queryStringParameters.startDate,
        endDate: event.queryStringParameters.endDate,
        limit: event.queryStringParameters.limit ? parseInt(event.queryStringParameters.limit) : undefined,
        sortOrder: event.queryStringParameters.sortOrder as 'ASC' | 'DESC' | undefined,
        mailbox: event.queryStringParameters.mailbox as 'inbox' | 'sent' | 'archived' | undefined,
      }
    } else if (event.body) {
      request = JSON.parse(event.body) as ListEmailsRequest
    } else {
      request = {}
    }

    const { sender, startDate, endDate, limit, lastEvaluatedKey, sortOrder, mailbox } = request

    // Build query parameters
    let keyConditionExpression: string
    const expressionAttributeValues: Record<string, unknown> = {}
    const expressionAttributeNames: Record<string, string> = {}
    let indexName: string | undefined
    let filterExpression: string | undefined

    // Determine query strategy based on mailbox type
    if (mailbox === 'sent') {
      // Query sent emails using SenderTimestampIndex
      indexName = 'SenderTimestampIndex'
      keyConditionExpression = '#sender = :sender'
      expressionAttributeNames['#sender'] = 'sender'
      expressionAttributeValues[':sender'] = recipient // User's emails they sent

      // Add timestamp range if provided
      if (startDate && endDate) {
        keyConditionExpression += ' AND #timestamp BETWEEN :startDate AND :endDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':startDate'] = startDate
        expressionAttributeValues[':endDate'] = endDate
      } else if (startDate) {
        keyConditionExpression += ' AND #timestamp >= :startDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':startDate'] = startDate
      } else if (endDate) {
        keyConditionExpression += ' AND #timestamp <= :endDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':endDate'] = endDate
      }
    } else if (sender) {
      // If sender is provided, use GSI
      indexName = 'RecipientSenderIndex'
      const recipientSender = `${recipient}#${sender}`
      keyConditionExpression = '#recipientSender = :recipientSender'
      expressionAttributeNames['#recipientSender'] = 'recipient_sender'
      expressionAttributeValues[':recipientSender'] = recipientSender

      // Add timestamp range if provided
      if (startDate && endDate) {
        keyConditionExpression += ' AND #timestamp BETWEEN :startDate AND :endDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':startDate'] = startDate
        expressionAttributeValues[':endDate'] = endDate
      } else if (startDate) {
        keyConditionExpression += ' AND #timestamp >= :startDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':startDate'] = startDate
      } else if (endDate) {
        keyConditionExpression += ' AND #timestamp <= :endDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':endDate'] = endDate
      }

      // Add filter for inbox/archived if specified
      if (mailbox === 'inbox') {
        filterExpression = '#archived = :archived'
        expressionAttributeNames['#archived'] = 'archived'
        expressionAttributeValues[':archived'] = false
      } else if (mailbox === 'archived') {
        filterExpression = '#archived = :archived'
        expressionAttributeNames['#archived'] = 'archived'
        expressionAttributeValues[':archived'] = true
      }
    } else {
      // Use primary key query
      keyConditionExpression = '#recipient = :recipient'
      expressionAttributeNames['#recipient'] = 'recipient'
      expressionAttributeValues[':recipient'] = recipient

      // Add timestamp range if provided
      if (startDate && endDate) {
        keyConditionExpression += ' AND #timestamp BETWEEN :startDate AND :endDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':startDate'] = startDate
        expressionAttributeValues[':endDate'] = endDate
      } else if (startDate) {
        keyConditionExpression += ' AND #timestamp >= :startDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':startDate'] = startDate
      } else if (endDate) {
        keyConditionExpression += ' AND #timestamp <= :endDate'
        expressionAttributeNames['#timestamp'] = 'timestamp'
        expressionAttributeValues[':endDate'] = endDate
      }

      // Add filter for inbox/archived if specified
      if (mailbox === 'inbox') {
        filterExpression = '#archived = :archived'
        expressionAttributeNames['#archived'] = 'archived'
        expressionAttributeValues[':archived'] = false
      } else if (mailbox === 'archived') {
        filterExpression = '#archived = :archived'
        expressionAttributeNames['#archived'] = 'archived'
        expressionAttributeValues[':archived'] = true
      }
    }

    // Query DynamoDB
    const result = await query<EmailMetadata>({
      tableName,
      keyConditionExpression,
      expressionAttributeValues,
      expressionAttributeNames,
      filterExpression,
      indexName,
      limit: limit || 50, // Default to 50 items per page
      exclusiveStartKey: lastEvaluatedKey,
      sortOrder: sortOrder || 'DESC', // Default to newest first
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emails: result.items,
        lastEvaluatedKey: result.lastEvaluatedKey,
        count: result.items.length,
      }),
    }
  } catch (error) {
    console.error('Error listing emails:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to list emails',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
