import { v4 } from 'uuid'
import { query } from '../dynamo-helpers/query'

interface DetermineThreadIdResult {
  thread_id: string
  isNewThread: boolean
}

/**
 * Determines the thread_id for an email based on its Message-ID, In-Reply-To, and References headers.
 *
 * Threading Algorithm:
 * 1. If In-Reply-To exists: Look up the thread_id from thread_relations using MessageIdIndex
 * 2. If not found and References exist: Try each referenced Message-ID (newest to oldest)
 * 3. If still not found: Generate a new thread_id (UUID) for a new conversation thread
 *
 * @param message_id - The Message-ID of the current email
 * @param in_reply_to - The In-Reply-To header (Message-ID this email replies to)
 * @param references - Array of Message-IDs from the References header
 * @param tableName - The thread_relations DynamoDB table name
 * @returns Object with thread_id and isNewThread flag
 */
export async function determineThreadId(
  message_id: string,
  in_reply_to: string | undefined,
  references: string[] | undefined,
  tableName: string
): Promise<DetermineThreadIdResult> {
  // Try to find existing thread from In-Reply-To header
  if (in_reply_to) {
    const threadId = await lookupThreadByMessageId(in_reply_to, tableName)
    if (threadId) {
      return { thread_id: threadId, isNewThread: false }
    }
  }

  // Try to find existing thread from References header (newest to oldest)
  if (references && references.length > 0) {
    // References are ordered oldest to newest, so reverse to check newest first
    const reversedReferences = [...references].reverse()

    for (const refMessageId of reversedReferences) {
      const threadId = await lookupThreadByMessageId(refMessageId, tableName)
      if (threadId) {
        return { thread_id: threadId, isNewThread: false }
      }
    }
  }

  // No existing thread found - create new thread
  const newThreadId = v4()
  return { thread_id: newThreadId, isNewThread: true }
}

/**
 * Looks up a thread_id by querying the MessageIdIndex GSI for a specific message_id.
 * Since message_ids are globally unique, we don't need to filter by recipient.
 *
 * @param message_id - The Message-ID to look up
 * @param tableName - The thread_relations table name
 * @returns The thread_id if found, undefined otherwise
 */
async function lookupThreadByMessageId(
  message_id: string,
  tableName: string
): Promise<string | undefined> {
  try {
    const result = await query({
      tableName,
      indexName: 'MessageIdIndex',
      keyConditionExpression: 'message_id = :messageId',
      expressionAttributeValues: {
        ':messageId': message_id,
      },
      limit: 1, // We only need one result
    })

    if (result.items && result.items.length > 0) {
      return result.items[0].thread_id as string
    }

    return undefined
  } catch (error) {
    console.error('Error looking up thread by message_id:', error)
    return undefined
  }
}
