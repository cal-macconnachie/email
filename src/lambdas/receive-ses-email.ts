import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Context, SESEvent } from 'aws-lambda'
import { create } from './helpers/dynamo-helpers/create'
import { parseEmail } from './helpers/parse-email'
import { determineThreadId } from './helpers/thread-helpers/determine-thread-id'

const s3Client = new S3Client({ region: process.env.REGION })

export const handler = async (event: SESEvent, _context: Context): Promise<void> => {
  console.log('SES Event received:', JSON.stringify(event, null, 2))

  const bucketName = process.env.S3_BUCKET_NAME
  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set')
  }

  const tableName = process.env.DYNAMODB_TABLE_NAME
  if (!tableName) {
    throw new Error('DYNAMODB_TABLE_NAME environment variable is not set')
  }

  const threadRelationsTableName = `${process.env.DYNAMODB_TABLE_NAME?.replace('-emails', '')}-thread-relations`

  // Process each SES record
  for (const record of event.Records) {
    try {
      const sesRecord = record.ses
      const mail = sesRecord.mail
      // Get the S3 location where SES stored the raw email
      if (!process.env.S3_BUCKET_NAME) {
        throw new Error('S3 action not found in receipt. Ensure SES is configured to store emails in S3.')
      }

      const key = `incoming/${mail.messageId}`

      // Fetch the raw email from S3
      const getObjectResponse = await s3Client.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      }))

      const rawEmailString = await getObjectResponse.Body?.transformToString()
      if (!rawEmailString) {
        throw new Error('Failed to fetch raw email content from S3')
      }

      // Parse the email
      const { emails, attachments } = parseEmail(rawEmailString)

      // Extract basic info
      const messageId = mail.messageId
      const timestamp = new Date(mail.timestamp)
      const date = timestamp.toISOString().split('T')[0] // YYYY-MM-DD format

      // Process each parsed email (one per recipient)
      for (const email of emails) {
        const recipient = email.recipient
        const sanitizedRecipient = recipient.toLowerCase().replace(/[^a-z0-9@._-]/g, '_')

        // Determine thread_id for this email
        const { thread_id } = await determineThreadId(
          email.message_id,
          email.in_reply_to,
          email.references,
          recipient,
          threadRelationsTableName
        )
        email.thread_id = thread_id

        // Store attachments first and collect their S3 keys
        const attachmentKeys: string[] = []
        if (attachments && attachments.length > 0) {
          for (const attachment of attachments) {
            const attachmentKey = `${sanitizedRecipient}/${date}/${messageId}/${attachment.filename}`
            console.log(`Storing attachment: ${bucketName}/${attachmentKey}`)

            await s3Client.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: attachmentKey,
              Body: attachment.rawContent,
              ContentType: attachment.contentType,
              Metadata: {
                'message-id': messageId,
                'recipient': recipient,
                'original-filename': attachment.filename,
              },
            }))

            attachmentKeys.push(attachmentKey)
          }
        }

        // Update the email object with S3 key and attachment keys
        const emailKey = `${sanitizedRecipient}/${date}/${messageId}.json`
        email.s3_key = emailKey
        email.attachment_keys = attachmentKeys

        // Store the parsed email JSON
        console.log(`Storing parsed email to: ${bucketName}/${emailKey}`)
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: emailKey,
          Body: JSON.stringify(email),
          ContentType: 'application/json',
          Metadata: {
            'message-id': messageId,
            'recipient': recipient,
            'sender': email.sender,
            'subject': email.subject,
          },
        }))

        console.log(`Successfully stored email for ${recipient}`)

        // Store thread relationship in thread_relations table
        await create({
          tableName: threadRelationsTableName,
          key: {
            thread_id: email.thread_id,
            timestamp: email.timestamp,
          },
          record: {
            message_id: email.message_id,
            recipient: email.recipient,
            subject: email.subject,
          },
        })

        console.log(`Successfully stored thread relationship for ${recipient}`)

        // Store metadata in DynamoDB (body is in S3 only)
        await create({
          tableName,
          key: {
            recipient: email.recipient,
            timestamp: email.timestamp,
          },
          record: {
            id: email.id,
            recipient_sender: email.recipient_sender,
            sender: email.sender,
            subject: email.subject,
            cc: email.cc,
            bcc: email.bcc,
            reply_to: email.reply_to,
            s3_key: emailKey,
            attachment_keys: attachmentKeys,
            created_at: email.created_at,
            read: false,
            archived: false,
            thread_id: email.thread_id,
            message_id: email.message_id,
            in_reply_to: email.in_reply_to,
            references: email.references,
          },
        })

        console.log(`Successfully stored DynamoDB record for ${recipient}`)
      }

      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      }))
    } catch (error) {
      console.error('Error processing SES record:', error)
      throw error
    }
  }
}
