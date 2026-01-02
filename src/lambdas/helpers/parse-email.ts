/*
Generic email string structure for testing

Return-Path: <cal.macconnachie@gmail.com>
Received: from mail-qt1-f178.google.com (mail-qt1-f178.google.com [209.85.160.178])
 by inbound-smtp.us-east-1.amazonaws.com with SMTP id 8i6cr4aeu15skb2lb71a0qo4ts7a8mbou5nfpgg1
 for cal@csm.codes;
 Sat, 26 Apr 2025 16:24:59 +0000 (UTC)
X-SES-Spam-Verdict: PASS
X-SES-Virus-Verdict: PASS
Received-SPF: pass (spfCheck: domain of _spf.google.com designates 209.85.160.178 as permitted sender) client-ip=209.85.160.178; envelope-from=cal.macconnachie@gmail.com; helo=mail-qt1-f178.google.com;
Authentication-Results: amazonses.com;
 spf=pass (spfCheck: domain of _spf.google.com designates 209.85.160.178 as permitted sender) client-ip=209.85.160.178; envelope-from=cal.macconnachie@gmail.com; helo=mail-qt1-f178.google.com;
 dkim=pass header.i=@gmail.com;
 dmarc=pass header.from=gmail.com;
X-SES-RECEIPT: AEFBQUFBQUFBQUFGQWpOcCtRU3V4WkdqeWFTZmN0UGo2V2lDbTNlN2RnWUllUWd4NHpFVWZ6ZmlydEIxa3IreDZ5U3ZMcTAwRFA5WWdTM3BVanMvaGloV2x0cWNDeThLSnZ0eXlJemtyOCs5N2pLSlk1TWt6alVhNTJBYWJYREp5LzZwSWRKOHc1ZTZkSnVQV2pLRXpITXhVdkw5RTM2ZTlxVE5ZdEFXZjBsd0VZLzBnanc4YUhqbDRJSWhGTmE1MGZwa0p0NUUvcmxhUU1sL3NsRGpnU25lSXlaVm0wNXY2NFR2MlRyVitYUzB3ZXVsV1kxVnpEbDBrUTAyVG5lUGxTMERQUkh5S1F2YUhOeWdhbnNuTUlkT2FEWkpGdG96MzhJZWRqV202K3ZyT0lXZW04cngzSHc9PQ==
X-SES-DKIM-SIGNATURE: a=rsa-sha256; q=dns/txt; b=iiE56l2xcLcEOcwuRvfE3gi12oxtQdGy9sqC7SWoxJquojPXr7x/iDuNJKsvrzBoZAeRsFayY4ZU1rp4eenfviLnCb+ozsdwNXn0z4SNFz9RnVpAKra+bc6AI6JG+IQoCLrDjnX0DfO4Qnv3Xs/K/onnsJipBiadt44+/hYkDHc=; c=relaxed/simple; s=6gbrjpgwjskckoa6a5zn6fwqkn67xbtw; d=amazonses.com; t=1745684699; v=1; bh=mBi9BMBxgu3jbewJtw44QRHqFbxComYgb4JI8WpKNXs=; h=From:To:Cc:Bcc:Subject:Date:Message-ID:MIME-Version:Content-Type:X-SES-RECEIPT;
Received: by mail-qt1-f178.google.com with SMTP id d75a77b69052e-47691d82bfbso77166721cf.0
        for <cal@csm.codes>; Sat, 26 Apr 2025 09:24:59 -0700 (PDT)
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=gmail.com; s=20230601; t=1745684699; x=1746289499; darn=csm.codes;
        h=to:subject:message-id:date:from:mime-version:from:to:cc:subject
         :date:message-id:reply-to;
        bh=mBi9BMBxgu3jbewJtw44QRHqFbxComYgb4JI8WpKNXs=;
        b=XQE9B5ZaJVttDhGPC/pfs/6elhIjiWNpU/C2PQiEPgq3mCM718GxqQjVC+/a6hMa5Q
         nKA31ziPCqEAlr1pmx8hev1ZDw0bFi7GKFCxewmgfO2ELZOaX8o0i5CDF3svwhJGMS8K
         ZCGuIi7NoKVqbh9R0jqja+XJ6gB8XHAFUQDwQGsTasz2cSNoRagV8SC2V2vmdO6RaqAd
         clf3jbd7wJ7PJ2faKnsHGH8DL0yLpFcjZbEr2utv7Zbqz0yw7EqeuZuGd5q05zta1fG5
         0e4nE5gGnsejZaqJa51KN5x97Jn1jCsHX7EVh/YyO5rKwNB06TA/mMZotO3eUQzYrqxU
         4wkQ==
X-Google-DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=1e100.net; s=20230601; t=1745684699; x=1746289499;
        h=to:subject:message-id:date:from:mime-version:x-gm-message-state
         :from:to:cc:subject:date:message-id:reply-to;
        bh=mBi9BMBxgu3jbewJtw44QRHqFbxComYgb4JI8WpKNXs=;
        b=pTpZdJgrRdoTL+ZD9jkIuwW5oyLrZELTwO7IbA/ok8TUNRVVLSDWp2HP9Uy+KnzUux
         0ghhStmltxduWZwoTphsav3kk92BS0u1HzadJJruQCU5OGG9buLp5fnNBWF15C8GdraZ
         nGiY+u2MuidJzEeMCrhtNYF1M7MBg3e08idvldBVlYiFKgrIZBLUBshGjGLby0fxMxiH
         uhrVgF0A7MXSHifHhXCV+X4SbzrftD2i+iqQyk9epNAtMukJEe8i1qroVasNaygM35xQ
         b0lzn/P/acArrJscxjWqM1/H/EBQHKPfVgcZb63njz7Bp9n76Od6+fA2qFU6AEKhZ7HE
         HYfw==
X-Gm-Message-State: AOJu0YwP4VED655+wvC8ExxZ/KIIlYdMeWMIyvpUGxoY/mFNms37MsD8
	CVQsvrca58d88wsR/C/ioICN7/xfL3jWicP9PeAtFeBSFw2xz6nk8ZbmKGaDY4F72Fa5X54xrrh
	fi8Sr9S2iO9uC9i04We5XO4o+9L+2JA==
X-Gm-Gg: ASbGncvj1rN79/KZht/We71O3ICbo1+0OinrrUVR8dRnsObDTr7HOdXy27MYovmU6S3
	Ci8U9nsqf/GG6fShcNJbN/8syomz6s1HJzspgQO7070QUfuo90A3ZUQBtphgN0pFTSXg/BLVEgs
	IfnEb65EL8u/XOCcvIesJIbhIjfkreWPHy1LAHYh2KkphCTk5W4cxZxg==
X-Google-Smtp-Source: AGHT+IFZOgiu1VtbZDz/a5jeA0MxwTLhDXOTjtVm9x+Dl3k5F06oANZkRXzmBYcQ8NrTCr93jqSj+rLEvSr+m4J6Z9Q=
X-Received: by 2002:a05:690c:630d:b0:6fb:2c34:8ee4 with SMTP id
 00721157ae682-7085f1744e0mr51781677b3.13.1745684090591; Sat, 26 Apr 2025
 09:14:50 -0700 (PDT)
MIME-Version: 1.0
From: cal macconnachie <cal.macconnachie@gmail.com>
Date: Sat, 26 Apr 2025 09:14:39 -0700
X-Gm-Features: ATxdqUFHCs68d8oU627sir-eWUzZS7rmc-h29NFntCO6uDA5GHUN5VJR_MYswUg
Message-ID: <CADT6VFxEQYvh70jNfn-jQ7SN7E66g9cU9fHHkF3V20ngn05g1w@mail.gmail.com>
Subject: test
To: cal@csm.codes
Content-Type: multipart/alternative; boundary="0000000000001c24cf0633b0c0b5"

--0000000000001c24cf0633b0c0b5
Content-Type: text/plain; charset="UTF-8"

test

--0000000000001c24cf0633b0c0b5
Content-Type: text/html; charset="UTF-8"

<div dir="ltr">test</div>

--0000000000001c24cf0633b0c0b5--


*/

import { v4 } from 'uuid'

export interface AttachmentUrl {
    key: string
    filename: string
    viewUrl: string
    downloadUrl: string
}

export interface Email {
    recipient: string
    sender: string
    recipient_sender: string
    cc?: string[]
    bcc?: string[]
    reply_to?: string[]
    subject: string
    s3_key: string
    body?: string
    timestamp: string
    created_at: string
    id: string
    attachment_keys?: string[]
    attachments?: AttachmentUrl[]
    read: boolean
    archived: boolean
    thread_id: string
    message_id: string
    in_reply_to?: string
    references?: string[]
    threadEmails?: Email[]
}

export function parseEmail(emailString: string): {
    emails: Email[];
    attachments?: Array<{ filename: string; contentType: string; rawContent: Buffer; contentId?: string }>;
} {
    const headers: Record<string, string> = {}
    const bodyParts: string[] = []
    const attachments: Array<{ filename: string; contentType: string; rawContent: Buffer; contentId?: string }> = []
    let isBody = false

    // Split the email string into lines
    const lines = emailString.split('\n')

    for (const line of lines) {
        if (isBody) {
            bodyParts.push(line)
        } else if (line.trim() === '') {
            isBody = true // Start of the body
        } else {
            const [key, ...value] = line.split(':')
            if (key && value) {
                headers[key.trim().toLowerCase()] = value.join(':').trim()
            }
        }
    }

    const body = extractHtmlBody(bodyParts.join('\n').trim(), attachments)
    const to = headers['to']
    const from = headers['from']
    const subject = headers['subject'] ?? ''
    const messageId = headers['message-id'] ?? ''
    const inReplyTo = headers['in-reply-to']
    const referencesHeader = headers['references']

    if (!to || !from) {
        throw new Error('Missing required email fields: to, from, or subject')
    }

    const toAddress = to.split(',').map(addr => addr.trim()) // Handle multiple recipients, use the first one

    const id = v4()

    // Parse references header (space-separated list of Message-IDs)
    const references = referencesHeader
        ? referencesHeader.split(/\s+/).filter(ref => ref.trim().length > 0)
        : undefined

    return {
        emails: toAddress.map((to) => ({
            recipient: formatEmailAddress(to),
            sender: formatEmailAddress(from),
            recipient_sender: `${formatEmailAddress(to)}#${formatEmailAddress(from)}`,
            cc: headers['cc'] ? headers['cc'].split(',').map((email) => email.trim()).map((em) => formatEmailAddress(em)) : [],
            bcc: headers['bcc'] ? headers['bcc'].split(',').map((email) => email.trim()).map((em) => formatEmailAddress(em)) : [],
            reply_to: headers['reply-to'] ? headers['reply-to'].split(',').map((email) => email.trim()).map((em) => formatEmailAddress(em)) : [],
            subject,
            body,
            s3_key: '',
            timestamp: `${new Date().toISOString()}#${id}`,
            created_at: new Date().toISOString(),
            id,
            read: false,
            archived: false,
            thread_id: '', // Will be set by determineThreadId helper
            message_id: messageId,
            in_reply_to: inReplyTo,
            references,
        })),
        attachments,
    }
}

function formatEmailAddress(email: string): string {
    // 'cal macconnachie <cal.macconnachie@gmail.com>' -> 'cal.macconnachie@gmail.com'
    const match = email.match(/<([^>]+)>/)
    return match ? match[1].trim() : email.trim()
}

function extractHtmlBody(body: string, attachments: Array<{ filename: string; contentType: string; rawContent: Buffer; contentId?: string }>): string {
    const parts = body.split('--')
    let htmlBody = ''

    for (const part of parts) {
        if (part.includes('Content-Type: text/html')) {
            const lines = part.split('\n')
            let isContent = false
            let content = ''

            for (const line of lines) {
                if (isContent) {
                    content += line + '\n'
                }
                if (line.includes('Content-Type: text/html')) {
                    isContent = true // Start capturing content after this line
                }
            }

            htmlBody += content.trim() // Append the captured content
        } else if (part.includes('Content-Disposition: attachment')) {
            const filenameMatch = part.match(/filename="(.+?)"/)
            const contentTypeMatch = part.match(/Content-Type: (.+?);/)
            const contentIdMatch = part.match(/Content-ID:\s*<([^>]+)>/i)
            const rawContentStartIndex = part.indexOf('\r\n\r\n') + 4 // Find the start of the raw content
            const rawContent = part.slice(rawContentStartIndex).trim()

            if (filenameMatch && rawContent) {
                attachments.push({
                    filename: filenameMatch[1],
                    contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                    rawContent: Buffer.from(rawContent, 'base64'),
                    contentId: contentIdMatch ? contentIdMatch[1] : undefined,
                })
            }
        } else if (part.includes('Content-Disposition: inline')) {
            const filenameMatch = part.match(/filename="(.+?)"/)
            const contentTypeMatch = part.match(/Content-Type: (.+?);/)
            const contentIdMatch = part.match(/Content-ID:\s*<([^>]+)>/i)
            const rawContentStartIndex = part.indexOf('\r\n\r\n') + 4 // Find the start of the raw content
            const rawContent = part.slice(rawContentStartIndex).trim()

            if (filenameMatch && rawContent) {
                attachments.push({
                    filename: filenameMatch[1],
                    contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
                    rawContent: Buffer.from(rawContent, 'base64'),
                    contentId: contentIdMatch ? contentIdMatch[1] : undefined,
                })
            }
        }
    }

    return htmlBody.trim()
}