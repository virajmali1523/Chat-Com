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
    } catch (error: any) {
      console.error('Error uploading image:', error);
      
 
      if (error.code === 'storage/unauthorized') {
        console.error('Storage access denied. Check CORS configuration and storage rules.');
        throw new Error('Storage access denied. Please check your permissions.');
      } else if (error.code === 'storage/quota-exceeded') {
        console.error('Storage quota exceeded.');
        throw new Error('Storage quota exceeded. Please try again later.');
      } else if (error.code === 'storage/network-request-failed') {
        console.error('Network request failed. Check your internet connection.');
        throw new Error('Network error. Please check your internet connection.');
      }
      
      throw new Error('Failed to upload image. Please try again.');
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
