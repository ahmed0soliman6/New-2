# Firebase setup

The application now uses Firebase Authentication and Firestore transactions. Before first login, create or select a Firebase project and register a Web App in **Project settings → Your apps**.

Enable **Authentication → Sign-in method → Email/Password**. Create a Firestore database in production mode, then deploy `firestore.rules`.

Copy the following values into a local `.env` file at the project root. Do not commit this file:

```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."
```

The first account created through the application is a `DOCTOR` account. The account document is written to `users/{firebaseUid}` only after Firebase Authentication succeeds. The application does not store passwords in Firestore.

The following operations use Firestore transactions:

- Creating a patient and appointment together.
- Checking in an appointment with `ARRIVED`, invoice, payment, and waiting visit.
- Registering a walk-in with patient, invoice, payment, and waiting visit.
- Starting a visit after verifying `WAITING`.
- Completing a visit after verifying `IN_PROGRESS`.

A failed transaction does not publish a waiting visit. Payment-provider integration is outside the current project; the transaction is called after the collection action reports success.
