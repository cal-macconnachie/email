import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({ region: process.env.REGION })

export interface AttachmentWithUrls {
  key: string
  filename: string
  viewUrl: string
  downloadUrl: string
  contentId?: string
}

/**
 * Generate presigned URLs for viewing and downloading an S3 object
 * @param bucketName - The S3 bucket name
 * @param key - The S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Object with view and download URLs
 */
export async function generatePresignedUrls(
  bucketName: string,
  key: string,
  expiresIn: number = 3600
): Promise<{ viewUrl: string; downloadUrl: string }> {
  // Generate URL for viewing (inline)
  const viewCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ResponseContentDisposition: 'inline',
  })
  const viewUrlPromise = getSignedUrl(s3Client, viewCommand, { expiresIn })

  // Generate URL for downloading (attachment)
  const filename = key.split('/').pop() || 'attachment'
  const downloadCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  })
  const downloadUrlPromise = getSignedUrl(s3Client, downloadCommand, { expiresIn })
  const [
    viewUrl,
    downloadUrl,
  ] = await Promise.all([viewUrlPromise, downloadUrlPromise])
  return { viewUrl, downloadUrl }
}

/**
 * Generate presigned URLs for multiple attachment keys
 * @param bucketName - The S3 bucket name
 * @param attachmentKeys - Array of S3 object keys
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Array of attachment objects with presigned URLs
 */
export async function generateAttachmentUrls(
  bucketName: string,
  attachmentKeys: string[],
  expiresIn: number = 3600
): Promise<AttachmentWithUrls[]> {
  const urlPromises = attachmentKeys.map(async (key) => {
    const { viewUrl, downloadUrl } = await generatePresignedUrls(bucketName, key, expiresIn)
    const filename = key.split('/').pop() || 'attachment'

    // Retrieve Content-ID from S3 metadata if it exists
    let contentId: string | undefined
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
      const headResponse = await s3Client.send(headCommand)
      contentId = headResponse.Metadata?.['content-id']
    } catch (error) {
      console.error(`Failed to retrieve metadata for ${key}:`, error)
      // Continue without contentId if metadata fetch fails
    }

    return {
      key,
      filename,
      viewUrl,
      downloadUrl,
      contentId,
    }
  })

  return Promise.all(urlPromises)
}
