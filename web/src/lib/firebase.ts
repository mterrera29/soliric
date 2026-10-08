import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAtAaeUQSNvkM7jN4QlgB0wJH9W4BoK0z0",
  authDomain: "lyricsapp-76075.firebaseapp.com",
  projectId: "lyricsapp-76075",
  storageBucket: "lyricsapp-76075.firebasestorage.app",
  messagingSenderId: "641770859748",
  appId: "1:641770859748:web:0e54f7f9c002954d82d0f1"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
