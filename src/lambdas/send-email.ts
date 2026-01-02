import { CopyObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Attachment, SESv2Client, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-sesv2'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'
import { v4 } from 'uuid'
import { create } from './helpers/dynamo-helpers/create'
import { Email } from './helpers/parse-email'
import { determineThreadId } from './helpers/thread-helpers/determine-thread-id'
import { getAuthenticatedRecipient } from './middleware/auth-middleware'

const sesClient = new SESv2Client({ region: process.env.REGION })
const s3Client = new S3Client({ region: process.env.REGION })

interface SendEmailRequest {
  to: string[]
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
  replyTo?: string[]
  attachmentKeys?: string[]
  inReplyTo?: string
  references?: string[]
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
    const authenticatedRecipient = authResult.recipient

    const bucketName = process.env.S3_BUCKET_NAME
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set')
    }

    const tableName = process.env.DYNAMODB_TABLE_NAME
    if (!tableName) {
      throw new Error('DYNAMODB_TABLE_NAME environment variable is not set')
    }

    const threadRelationsTableName = `${process.env.DYNAMODB_TABLE_NAME?.replace('-emails', '')}-thread-relations`

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const emailRequest = JSON.parse(event.body) as SendEmailRequest
    const { to, subject, body, cc, bcc, replyTo, attachmentKeys, inReplyTo, references } = emailRequest

    // Validate inputs
    if (!to || to.length === 0 || !subject || !body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'to (non-empty array), subject, and body are required' }),
      }
    }

    // Validate that from address matches authenticated user's email
    const from = authenticatedRecipient
    if (from !== authenticatedRecipient) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Forbidden - You can only send from your own email address: ${authenticatedRecipient}` }),
      }
    }

    // can only send from verified identities in SES
    // we have verified macconnachie.com for sending
    // so enforce that here
    if (!from.endsWith('@macconnachie.com')) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'from address must be a verified identity in SES' }),
      }
    }

    // Fetch attachments from S3 if provided
    const attachments: Attachment[] = []
    const attachmentFilenames: string[] = []
    if (attachmentKeys && attachmentKeys.length > 0) {
      for (const key of attachmentKeys) {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
        const response = await s3Client.send(command)
        if (!response.Body) {
          throw new Error(`No body found in S3 object for key: ${key}`)
        }

        const filename = key.split('/').pop() || 'attachment'
        attachmentFilenames.push(filename)

        const attachment: Attachment = {
          FileName: filename,
          ContentType: response.ContentType || 'application/octet-stream',
          RawContent: await response.Body.transformToByteArray(),
        }
        attachments.push(attachment)
      }
    }


    // Construct raw MIME email
    const boundary = 'NextPartBoundary'
    let rawEmail = `From: ${from}\n`
    rawEmail += `To: ${to.join(', ')}\n`
    if (cc && cc.length > 0) {
      rawEmail += `Cc: ${cc.join(', ')}\n`
    }
    if (bcc && bcc.length > 0) {
      rawEmail += `Bcc: ${bcc.join(', ')}\n`
    }
    rawEmail += `Subject: ${subject}\n`
    if (inReplyTo) {
      rawEmail += `In-Reply-To: ${inReplyTo}\n`
    }
    if (references && references.length > 0) {
      rawEmail += `References: ${references.join(' ')}\n`
    }
    rawEmail += 'MIME-Version: 1.0\n'
    rawEmail += `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`

    rawEmail += `--${boundary}\n`
    rawEmail += 'Content-Type: text/html; charset="UTF-8"\n\n'
    rawEmail += `${body}\n\n`

    for (const attachment of attachments) {
      rawEmail += `--${boundary}\n`
      rawEmail += `Content-Type: ${attachment.ContentType}; name="${attachment.FileName}"\n`
      rawEmail += `Content-Disposition: attachment; filename="${attachment.FileName}"\n`
      rawEmail += 'Content-Transfer-Encoding: base64\n\n'
      rawEmail += `${Buffer.from(attachment.RawContent ?? '').toString('base64')}\n\n`
    }

    rawEmail += `--${boundary}--`

    // Send email via SES
    const commandInput: SendEmailCommandInput = {
      FromEmailAddress: from,
      Destination: {
        ToAddresses: to,
      },
      Content: {
        Raw: {
          Data: Buffer.from(rawEmail) as Uint8Array,
        },
      },
    }
    if (cc && cc.length > 0 && commandInput.Destination) {
      commandInput.Destination.CcAddresses = cc
    }
    if (bcc && bcc.length > 0 && commandInput.Destination) {
      commandInput.Destination.BccAddresses = bcc
    }
    if (replyTo && replyTo.length > 0) {
      commandInput.ReplyToAddresses = replyTo
    }

    const command = new SendEmailCommand(commandInput)
    const sesResponse = await sesClient.send(command)
    const messageId = sesResponse.MessageId || v4()

    console.log(`Email sent successfully with MessageId: ${messageId}`)

    // Store sent email for each recipient
    const timestamp = new Date()
    const isoTimestamp = timestamp.toISOString()
    const date = isoTimestamp.split('T')[0] // YYYY-MM-DD format
    const id = v4()

    // Process each recipient
    for (const recipient of to) {
      const sanitizedRecipient = recipient.toLowerCase().replace(/[^a-z0-9@._-]/g, '_')

      // Determine thread_id for this email

      // Move attachments from pending to final location and collect keys
      const finalAttachmentKeys: string[] = []
      if (attachmentKeys && attachmentKeys.length > 0) {
        for (let i = 0; i < attachmentKeys.length; i++) {
          const pendingKey = attachmentKeys[i]
          const filename = attachmentFilenames[i]
          const finalKey = `${sanitizedRecipient}/${date}/${messageId}/${filename}`

          // Copy attachment to final location
          await s3Client.send(
            new CopyObjectCommand({
              Bucket: bucketName,
              CopySource: `${bucketName}/${pendingKey}`,
              Key: finalKey,
              ContentType: attachments[i].ContentType,
              Metadata: {
                'message-id': messageId,
                'recipient': recipient,
                'original-filename': filename,
              },
            })
          )

          finalAttachmentKeys.push(finalKey)
        }
      }

      // Create email object
      const emailKey = `${sanitizedRecipient}/${date}/${messageId}.json`
      const generatedMessageId = sesResponse.MessageId ? sesResponse.MessageId : `<${v4()}@macconnachie.com>`
      const { thread_id } = await determineThreadId(
        generatedMessageId,
        inReplyTo,
        references,
        recipient,
        threadRelationsTableName
      )
      const email: Email = {
        recipient,
        sender: from,
        recipient_sender: `${recipient}#${from}`,
        cc,
        bcc,
        reply_to: replyTo,
        subject,
        body,
        s3_key: emailKey,
        timestamp: `${isoTimestamp}#${id}`,
        created_at: isoTimestamp,
        id,
        attachment_keys: finalAttachmentKeys,
        read: false,
        archived: false,
        thread_id,
        message_id: generatedMessageId,
        in_reply_to: inReplyTo,
        references,
      }

      // Store email JSON in S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: emailKey,
          Body: JSON.stringify(email),
          ContentType: 'application/json',
          Metadata: {
            'message-id': messageId,
            'recipient': recipient,
            'sender': from,
            'subject': subject,
          },
        })
      )

      // Store thread relationship in thread_relations table
      await create({
        tableName: threadRelationsTableName,
        key: {
          thread_id,
          timestamp: email.timestamp,
        },
        record: {
          message_id: generatedMessageId,
          recipient,
          subject,
        },
      })

      // Store metadata in DynamoDB
      await create({
        tableName,
        key: {
          recipient,
          timestamp: email.timestamp,
        },
        record: {
          id,
          recipient_sender: email.recipient_sender,
          sender: from,
          subject,
          cc,
          bcc,
          reply_to: replyTo,
          s3_key: emailKey,
          attachment_keys: finalAttachmentKeys,
          created_at: isoTimestamp,
          read: false,
          archived: false,
          thread_id,
          message_id: generatedMessageId,
          in_reply_to: inReplyTo,
          references,
        },
      })

      console.log(`Successfully stored sent email for ${recipient}`)
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Email sent successfully',
        messageId,
        recipients: to,
      }),
    }
  } catch (error) {
    console.error('Error sending email:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
