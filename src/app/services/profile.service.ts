import { Injectable, inject, NgZone } from '@angular/core';
import { Auth, updateProfile, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private ngZone = inject(NgZone);

  getCurrentUser(): Promise<User> {
    return new Promise((resolve, reject) => {
      const user = this.auth.currentUser;
      if (user) {
        resolve(user);
      } else {
        onAuthStateChanged(this.auth, user => {
          this.ngZone.run(() => {
            user ? resolve(user) : reject('No user signed in');
          });
        });
      }
    });
  }

  async uploadImageAndGetURL(userId: string, file: File): Promise<string> {
    try {
      const filePath = `profile-pictures/${userId}.jpg`;
      const storageRef = ref(this.storage, filePath);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  async saveProfileData(user: User, displayName: string, photoURL: string, bio?: string): Promise<void> {
    try {
      await updateProfile(user, { displayName, photoURL });

      const userRef = doc(this.firestore, `users/${user.uid}`);
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        displayNameLower: displayName.toLowerCase(),
        photoURL,
        email: user.email,
        bio: bio || ''
      });
    } catch (error) {
      console.error('Error saving profile data:', error);
      throw error;
    }
  }
}
