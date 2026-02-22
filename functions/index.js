/**
 * TutorsLink Firebase Cloud Functions
 *
 * Functions:
 *   submitTutorApplication   — receives tutor application data, stores in Firestore,
 *                              optionally posts Discord notification via webhook.
 *   createSupportChatMessage — stores a chat message in Firestore.
 *   bookDemoClass            — records a demo class booking in Firestore,
 *                              optionally sends a Discord notification.
 *   syncDiscordAdsWebhook    — receives Discord webhook events (stub endpoint).
 *
 * Secrets / sensitive config should NEVER be committed to the repo.
 * Load them via Firebase Functions config or Secret Manager:
 *
 *   firebase functions:config:set discord.webhook_url="https://discord.com/api/webhooks/..."
 *   firebase functions:config:set discord.bot_token="Bot YOUR_TOKEN"
 *
 * Access in code: functions.config().discord.webhook_url
 * See docs/discord-integration.md for full setup instructions.
 */

'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/* ------------------------------------------------------------------ */
/*  Helper: send a Discord webhook notification (stubbed if not set)  */
/* ------------------------------------------------------------------ */
async function notifyDiscord(webhookUrl, embed) {
  if (!webhookUrl || webhookUrl.startsWith('REPLACE')) {
    functions.logger.info('[Discord stub] Webhook not configured — skipping notification.', embed);
    return;
  }
  const https = require('https');
  const body  = JSON.stringify({ embeds: [embed] });
  return new Promise((resolve, reject) => {
    const url  = new URL(webhookUrl);
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, (res) => { resolve(res.statusCode); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ------------------------------------------------------------------ */
/*  1. submitTutorApplication                                          */
/* ------------------------------------------------------------------ */
exports.submitTutorApplication = functions.https.onCall(async (data, context) => {
  /* Basic server-side validation */
  const required = ['firstName', 'lastName', 'email', 'primarySubject', 'teachingBio'];
  for (const field of required) {
    if (!data[field] || String(data[field]).trim() === '') {
      throw new functions.https.HttpsError('invalid-argument', `Missing required field: ${field}`);
    }
  }

  const application = {
    ...data,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    status:      'pending',
    uid:         context.auth ? context.auth.uid : null
  };

  const ref = await db.collection('tutorApplications').add(application);
  functions.logger.info('Tutor application submitted', { id: ref.id, email: data.email });

  /* Discord notification (optional) */
  const webhookUrl = functions.config().discord && functions.config().discord.webhook_url;
  await notifyDiscord(webhookUrl, {
    title:       '📋 New Tutor Application',
    description: `**${data.firstName} ${data.lastName}** applied to teach **${data.primarySubject}**.`,
    color:       0xFFD700,
    fields: [
      { name: 'Email',         value: data.email,            inline: true },
      { name: 'Country',       value: data.country || 'N/A', inline: true },
      { name: 'Experience',    value: data.teachingExperience || 'N/A', inline: true }
    ],
    timestamp: new Date().toISOString()
  });

  return { success: true, applicationId: ref.id };
});

/* ------------------------------------------------------------------ */
/*  2. createSupportChatMessage                                        */
/* ------------------------------------------------------------------ */
exports.createSupportChatMessage = functions.https.onCall(async (data, context) => {
  if (!data.message || String(data.message).trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'Message is required.');
  }

  const MAX_LENGTH = 2000;
  const messageText = String(data.message).trim().slice(0, MAX_LENGTH);
  const sessionId   = String(data.sessionId || 'unknown').slice(0, 64);

  const msg = {
    message:   messageText,
    sessionId: sessionId,
    sentAt:    admin.firestore.FieldValue.serverTimestamp(),
    uid:       context.auth ? context.auth.uid : null,
    role:      'user'
  };

  const ref = await db.collection('chatMessages').add(msg);
  functions.logger.info('Chat message stored', { id: ref.id, sessionId });

  return { success: true, messageId: ref.id };
});

/* ------------------------------------------------------------------ */
/*  3. bookDemoClass                                                   */
/* ------------------------------------------------------------------ */
exports.bookDemoClass = functions.https.onCall(async (data, context) => {
  if (!data.tutorId) {
    throw new functions.https.HttpsError('invalid-argument', 'tutorId is required.');
  }

  const booking = {
    tutorId:    String(data.tutorId),
    tutorName:  String((data.meta && data.meta.tutorName) || 'Unknown'),
    subject:    String((data.meta && data.meta.subject)   || 'Unknown'),
    bookedAt:   admin.firestore.FieldValue.serverTimestamp(),
    uid:        context.auth ? context.auth.uid : null,
    status:     'pending_confirmation'
  };

  const ref = await db.collection('demoBookings').add(booking);
  functions.logger.info('Demo booking created', { id: ref.id, tutorId: data.tutorId });

  /* Discord notification (optional) */
  const webhookUrl = functions.config().discord && functions.config().discord.webhook_url;
  await notifyDiscord(webhookUrl, {
    title:       '🎓 New Demo Booking',
    description: `A student booked a free demo with **${booking.tutorName}** (${booking.subject}).`,
    color:       0xFF1493,
    fields: [
      { name: 'Tutor ID', value: booking.tutorId, inline: true },
      { name: 'Status',   value: booking.status,  inline: true }
    ],
    timestamp: new Date().toISOString()
  });

  return { success: true, bookingId: ref.id };
});

/* ------------------------------------------------------------------ */
/*  5. Auto-grant staff (admin) role to the admin email on sign-up    */
/* ------------------------------------------------------------------ */
const ADMIN_EMAIL = 'tutorslink001@gmail.com';

exports.setAdminClaimOnCreate = functions.auth.user().onCreate(async (user) => {
  if (user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
    await admin.auth().setCustomUserClaims(user.uid, { staff: true });
    functions.logger.info('Granted staff claim to admin user', { uid: user.uid, email: user.email });
  }
});

/* ------------------------------------------------------------------ */
/*  6. Callable: assign tutor role when application is approved       */
/* ------------------------------------------------------------------ */
exports.approveTutorApplication = functions.https.onCall(async (data, context) => {
  /* Only staff may call this */
  if (!context.auth || !context.auth.token.staff) {
    throw new functions.https.HttpsError('permission-denied', 'Only staff can approve tutor applications.');
  }

  const uid = String(data.uid || '').trim();
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }

  /* Merge with existing claims to avoid removing any already-granted roles */
  const existing = (await admin.auth().getUser(uid)).customClaims || {};
  await admin.auth().setCustomUserClaims(uid, { ...existing, tutor: true });

  /* Update application status in Firestore if applicationId provided */
  if (data.applicationId) {
    await db.collection('tutorApplications').doc(String(data.applicationId)).update({
      status: 'approved',
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: context.auth.uid
    });
  }

  functions.logger.info('Approved tutor', { uid, approvedBy: context.auth.uid });
  return { success: true };
});

/* ------------------------------------------------------------------ */
/*  7. syncDiscordAdsWebhook                                           */
/*  Stub HTTP endpoint to receive events from Discord (e.g., bot ads) */
/* ------------------------------------------------------------------ */
exports.syncDiscordAdsWebhook = functions.https.onRequest(async (req, res) => {
  /* Verify Discord signature (TODO: implement with discord.js or raw HMAC) */
  /* See docs/discord-integration.md for signature verification details.     */

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const body = req.body || {};
  functions.logger.info('[syncDiscordAdsWebhook] Received event', { type: body.type });

  /* Stub: store raw event in Firestore for later processing */
  await db.collection('discordEvents').add({
    ...body,
    receivedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.status(200).json({ success: true });
});
