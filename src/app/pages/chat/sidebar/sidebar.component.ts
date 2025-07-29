import { Component, inject, NgZone } from '@angular/core';
import { Auth, signOut, updateProfile, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: false
})
export class SidebarComponent {
  displayName = '';
  bio = '';
  previewUrl = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
  selectedFile: File | null = null;

  uid = '';
  email = '';
  editMode = false;

  errorMessage = '';
  successMessage = '';
  loading = false;

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);

  constructor() {
    this.initializeAuthListener();
  }

  private initializeAuthListener() {
    onAuthStateChanged(this.auth, (user) => {
      this.ngZone.run(() => {
        if (user) {
          this.loadUserProfile(user);
        }
      });
    });
  }

  async loadUserProfile(user: User) {
    try {
      this.uid = user.uid;
      this.email = user.email || '';

      const docRef = doc(this.firestore, `users/${user.uid}`);
      const snap = await getDoc(docRef);

      this.ngZone.run(() => {
        if (snap.exists()) {
          const data = snap.data();
          this.displayName = data['displayName'] || '';
          this.bio = data['bio'] || '';
          this.previewUrl = data['photoURL'] || this.previewUrl;
        }
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.ngZone.run(() => {
        this.errorMessage = 'Failed to load profile data.';
      });
    }
  }

  toggleEdit() {
    this.editMode = !this.editMode;
    this.successMessage = '';
    this.errorMessage = '';
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.ngZone.run(() => {
        window.location.reload();
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];

      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Only image files are allowed.';
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.errorMessage = 'File size must be less than 5MB.';
        return;
      }

      this.selectedFile = file;

      const reader = new FileReader();
      reader.onload = () => {
        this.ngZone.run(() => {
          this.previewUrl = reader.result as string;
        });
      };
      reader.readAsDataURL(file);
    }
  }

  async uploadImageWithMultipart(userId: string): Promise<string> {
    if (!this.selectedFile) return this.previewUrl;

    try {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      formData.append('userId', userId);
      formData.append('folder', 'profile-pictures');

      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const idToken = await user.getIdToken();

      const response = await this.http.post<{ url: string }>('/api/upload-profile-image', formData, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }).toPromise();

      if (!response || !response.url) {
        throw new Error('Upload failed: No URL returned');
      }

      return response.url;
    } catch (error) {
      console.error('Multipart upload failed:', error);
      throw error;
    }
  }

  async uploadImageAndGetURL(userId: string): Promise<string> {
    if (!this.selectedFile) return this.previewUrl;

    const filePath = `profile-pictures/${userId}`;
    const storageRef = ref(this.storage, filePath);

    try {
      await uploadBytes(storageRef, this.selectedFile);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async saveProfile() {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    const user: User | null = this.auth.currentUser;
    if (!user) {
      this.errorMessage = 'User not logged in';
      this.loading = false;
      return;
    }

    try {
      let photoURL = user.photoURL || this.previewUrl;

      if (this.selectedFile) {
        photoURL = await this.uploadImageAndGetURL(user.uid);
      }

      await updateProfile(user, {
        displayName: this.displayName || '',
        photoURL: photoURL || ''
      });

      const userDoc = doc(this.firestore, 'users', user.uid);
      await setDoc(userDoc, {
        uid: user.uid,
        displayName: this.displayName || '',
        displayNameLower: (this.displayName || '').toLowerCase(),
        photoURL: photoURL || '',
        bio: this.bio || '',
        email: user.email || ''
      });

      this.ngZone.run(() => {
        this.successMessage = 'Profile updated!';
        this.editMode = false;
        this.selectedFile = null;
      });
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      this.ngZone.run(() => {
        this.errorMessage = 'Failed to update profile.';
      });
    } finally {
      this.ngZone.run(() => {
        this.loading = false;
      });
    }
  }
}
