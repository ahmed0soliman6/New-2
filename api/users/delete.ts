import crypto from 'node:crypto';

interface DeleteRequest {
  uid: string;
  username?: string;
}

function cleanPrivateKey(raw?: string): string | null {
  if (!raw) return null;
  let key = raw.trim();

  // Strip outer quotes repeatedly
  while ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // If user pasted JSON (e.g. serviceAccountKey.json contents)
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) key = parsed.private_key;
    } catch {}
  }

  // Strip outer quotes again if JSON string value was quoted
  while ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Replace escaped newlines (\\n or \n literals) with real newlines, remove carriage returns
  key = key.replace(/\\n/g, '\n').replace(/\r/g, '');

  // Ensure standard RSA PEM header and footer exist
  if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }

  return key.trim();
}

/**
 * Obtains a Google OAuth2 access token for the Firebase service account
 * using Node's native crypto module (Zero external dependencies).
 */
async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const toB64Url = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${toB64Url(header)}.${toB64Url(claimSet)}`;

  let signature = '';
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedToken);
    signature = signer.sign(privateKeyPem, 'base64url');
  } catch (err: any) {
    throw new Error(
      `صيغة المفتاح الخاص (FIREBASE_PRIVATE_KEY) غير صالحة: ${err?.message || 'خطأ في التشفير'}. تأكد من نسخ المفتاح الخاص كاملاً من ملف serviceAccountKey.json.`
    );
  }

  const jwt = `${unsignedToken}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    throw new Error(
      `فشل مصادقة حساب الخدمة من Google: ${data.error_description || data.error || tokenRes.status}. تحقق من صحة FIREBASE_CLIENT_EMAIL و FIREBASE_PRIVATE_KEY.`
    );
  }

  return data.access_token;
}

/**
 * Verifies caller's Firebase ID token using Google Identity Toolkit REST API with Service Account Access Token
 */
async function verifyCallerToken(projectId: string, accessToken: string, idToken: string): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.users || data.users.length === 0) {
    throw new Error('انتهت صلاحية جلسة المدير. يرجى إعادة تسجيل الدخول.');
  }

  return data.users[0].localId;
}

/**
 * Reads caller's or target user's role and active status from Firestore users collection
 */
async function getCallerRole(projectId: string, accessToken: string, callerUid: string): Promise<{ role: string; active: boolean }> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${callerUid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return { role: '', active: false };
  if (!res.ok) throw new Error('تعذّر التحقق من صلاحية المتصل.');
  const doc: any = await res.json();
  const fields = doc.fields || {};
  return {
    role: fields.role?.stringValue || '',
    active: fields.active?.booleanValue !== false,
  };
}

/**
 * Counts total active admin users in the system to prevent deleting the last admin
 */
async function countActiveAdmins(projectId: string, accessToken: string): Promise<number> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'role' },
          op: 'IN',
          value: {
            arrayValue: {
              values: [
                { stringValue: 'ADMIN' },
                { stringValue: 'admin' },
              ],
            },
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error('تعذّر التحقق من عدد المديرين في النظام.');
  }

  const results: any[] = await res.json();
  const activeAdmins = results.filter((r) => {
    if (!r.document || !r.document.fields) return false;
    const activeVal = r.document.fields.active?.booleanValue;
    return activeVal !== false;
  });

  return activeAdmins.length;
}

/**
 * Deletes a user account from Firebase Authentication using Google Identity Toolkit REST API
 */
async function deleteFromFirebaseAuth(projectId: string, accessToken: string, uid: string): Promise<boolean> {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localId: uid }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || '';
    // If user is already deleted from Auth, treat as success
    if (errorMsg.includes('USER_NOT_FOUND')) {
      return true;
    }
    throw new Error(`خطأ Firebase Auth أثناء الحذف: ${errorMsg || res.status}`);
  }

  return true;
}

/**
 * Deletes Firestore user document and username mapping using Firestore REST API with the access token
 */
async function deleteFromFirestore(projectId: string, accessToken: string, uid: string, username?: string) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  // Delete users/{uid}
  await fetch(`${base}/users/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});

  // Delete usernames/{normUsername}
  if (username) {
    const norm = username.trim().toLowerCase().replace(/^@+/, '');
    await fetch(`${base}/usernames/${norm}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  }
}

async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendResponse(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { error: 'الطريقة غير مسموح بها. استخدم POST.' });
  }

  try {
    // 1. Check Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return sendResponse(res, 401, { error: 'غير مصرح: يجب تسجيل الدخول برمز صالح' });
    }
    const idToken = authHeader.slice(7).trim();

    // 2. Resolve Environment Variables
    let projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID;

    let clientEmail =
      process.env.FIREBASE_CLIENT_EMAIL ||
      process.env.VITE_FIREBASE_CLIENT_EMAIL;

    let rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Helper to extract JSON properties if user pasted full serviceAccountKey.json into any env var
    const parseJsonCert = (val?: string) => {
      if (!val) return;
      let trimmed = val.trim();
      while ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        trimmed = trimmed.slice(1, -1).trim();
      }
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.client_email) clientEmail = parsed.client_email;
          if (parsed.private_key) rawPrivateKey = parsed.private_key;
          if (parsed.project_id) projectId = parsed.project_id;
        } catch {}
      }
    };

    parseJsonCert(process.env.FIREBASE_SERVICE_ACCOUNT);
    parseJsonCert(rawPrivateKey);

    // Auto-detect project ID from clientEmail domain if not specified
    if (!projectId && clientEmail && clientEmail.includes('@')) {
      const domain = clientEmail.split('@')[1];
      if (domain.includes('.iam.gserviceaccount.com')) {
        projectId = domain.replace('.iam.gserviceaccount.com', '');
      }
    }

    const privateKey = cleanPrivateKey(rawPrivateKey);

    const missingVars: string[] = [];
    if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missingVars.push('FIREBASE_PRIVATE_KEY');
    if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');

    if (missingVars.length > 0) {
      return sendResponse(res, 500, {
        error: `متغيرات بيئة Firebase غير مكتملة في Vercel: (${missingVars.join(
          ', '
        )}). تأكد من إضافتها لجميع البيئات (Production و Preview) ثم إعادة النشر (Redeploy).`,
      });
    }

    // 3. Parse Body
    const body = await parseBody(req);
    const { uid, username } = (body || {}) as DeleteRequest;

    if (!uid) {
      return sendResponse(res, 400, { error: 'معرّف المستخدم (uid) مطلوب للحذف.' });
    }

    // 4. Obtain Google Access Token
    const accessToken = await getGoogleAccessToken(clientEmail!, privateKey!);

    // 5. Verify Caller's session & role
    const callerUid = await verifyCallerToken(projectId!, accessToken, idToken);

    const caller = await getCallerRole(projectId!, accessToken, callerUid);
    const isAdminCaller = caller.active && (caller.role === 'ADMIN' || caller.role === 'admin');
    if (!isAdminCaller) {
      return sendResponse(res, 403, { error: 'لا تملك صلاحية حذف المستخدمين.' });
    }

    if (callerUid === uid) {
      return sendResponse(res, 400, { error: 'لا يمكنك حذف الحساب الحالي المسجل به.' });
    }

    // Prevent deleting the last admin
    const targetUser = await getCallerRole(projectId!, accessToken, uid);
    if (targetUser.role === 'ADMIN' || targetUser.role === 'admin') {
      const activeAdminCount = await countActiveAdmins(projectId!, accessToken);
      if (activeAdminCount <= 1) {
        return sendResponse(res, 400, { error: 'لا يمكن حذف آخر مدير في النظام' });
      }
    }

    // 6. Delete from Firebase Authentication
    await deleteFromFirebaseAuth(projectId!, accessToken, uid);

    // 7. Delete from Firestore (users & usernames)
    await deleteFromFirestore(projectId!, accessToken, uid, username);

    return sendResponse(res, 200, {
      success: true,
      message: 'تم حذف المستخدم نهائياً من Firebase Authentication و Firestore بنجاح.',
    });
  } catch (err: any) {
    console.error('User deletion error:', err);
    return sendResponse(res, 500, {
      error: err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة حذف المستخدم.',
    });
  }
}
