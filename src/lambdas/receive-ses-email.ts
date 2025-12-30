import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Context, SESEvent } from 'aws-lambda'
import { create } from './helpers/dynamo-helpers/create'

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

  // Process each SES record
  for (const record of event.Records) {
    try {
      const sesRecord = record.ses
      const mail = sesRecord.mail
      const receipt = sesRecord.receipt

      // Extract email details
      const messageId = mail.messageId
      const timestamp = new Date(mail.timestamp)
      const date = timestamp.toISOString().split('T')[0] // YYYY-MM-DD format
      const recipients = mail.commonHeaders.to || mail.destination

      // Get the email content (SES provides this in the record)
      const emailContent = JSON.stringify({
        messageId: messageId,
        timestamp: mail.timestamp,
        source: mail.source,
        subject: mail.commonHeaders.subject,
        from: mail.commonHeaders.from,
        to: mail.commonHeaders.to,
        cc: mail.commonHeaders.cc,
        bcc: mail.commonHeaders.bcc,
        returnPath: mail.commonHeaders.returnPath,
        headers: mail.headers,
        receipt: receipt,
      }, null, 2)

      // Store email for each recipient
      for (const recipient of recipients) {
        const sanitizedRecipient = recipient.toLowerCase().replace(/[^a-z0-9@._-]/g, '_')
        const key = `${sanitizedRecipient}/${date}/${messageId}.json`

        console.log(`Storing email to: ${bucketName}/${key}`)

        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: emailContent,
          ContentType: 'application/json',
          Metadata: {
            'message-id': messageId,
            'recipient': recipient,
            'source': mail.source,
            'subject': mail.commonHeaders.subject || 'no-subject',
          },
        }))

        console.log(`Successfully stored email for ${recipient}`)

        // Store metadata in DynamoDB for querying
        const isoTimestamp = timestamp.toISOString()
        await create({
          tableName,
          key: {
            recipient: recipient,
            timestamp: `${isoTimestamp}#${messageId}`, // Append messageId for uniqueness
          },
          record: {
            recipient_sender: `${recipient}#${mail.source}`, // For GSI queries
            sender: mail.source,
            subject: mail.commonHeaders.subject || '',
            s3_bucket: bucketName,
            s3_key: key,
            date: date,
            messageId: messageId,
            receivedAt: isoTimestamp,
          },
        })

        console.log(`Successfully stored DynamoDB record for ${recipient}`)
      }
    } catch (error) {
      console.error('Error processing SES record:', error)
      throw error
    }
  }
}
