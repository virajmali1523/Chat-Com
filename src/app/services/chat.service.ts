
import { Injectable, inject, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

export interface Message {
  id?: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  content: string;
  timestamp: Timestamp | Date;
  type: 'text' | 'image' | 'file';
  read: boolean;
  fileURL?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export interface Chat {
  chatId: string;
  participants: string[];
  lastMessage?: Message;
  lastMessageTime?: Timestamp | Date;
  unreadCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private selectedChatSource = new BehaviorSubject<Chat | null>(null);
  selectedChat$ = this.selectedChatSource.asObservable();

  private messagesSource = new BehaviorSubject<Message[]>([]);
  messages$ = this.messagesSource.asObservable();

  private currentUser = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private ngZone = inject(NgZone);

  private unsubscribeMessages: (() => void) | null = null;

  setSelectedChat(chat: Chat | null) {
    this.ngZone.run(() => {
      this.selectedChatSource.next(chat);
      
      if (this.unsubscribeMessages) {
        this.unsubscribeMessages();
        this.unsubscribeMessages = null;
      }

      if (chat) {
        this.loadMessages(chat.chatId);
      } else {
        this.messagesSource.next([]);
      }
    });
  }

  private loadMessages(chatId: string) {
    const messagesRef = collection(this.firestore, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    this.unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const messages: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data['senderId'],
          senderName: data['senderName'],
          senderPhotoURL: data['senderPhotoURL'],
          content: data['content'],
          timestamp: data['timestamp'],
          type: data['type'] || 'text',
          read: data['read'] || false,
          fileURL: data['fileURL'],
          fileName: data['fileName'],
          fileSize: data['fileSize'],
          fileType: data['fileType']
        });
      });

      this.ngZone.run(() => {
        this.messagesSource.next(messages);
      });
    });
  }

  async sendMessage(chatId: string, content: string, type: 'text' | 'image' | 'file' = 'text'): Promise<void> {
    try {
      const user = this.currentUser.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const messagesRef = collection(this.firestore, `chats/${chatId}/messages`);
      
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || 'Unknown User',
        senderPhotoURL: user.photoURL || '',
        content: content,
        timestamp: serverTimestamp(),
        type: type,
        read: false
      };

      await addDoc(messagesRef, messageData);

      const chatRef = doc(this.firestore, `chats/${chatId}`);
      await updateDoc(chatRef, {
        lastMessage: content,
        lastMessageTime: serverTimestamp()
      });

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendFileMessage(chatId: string, file: File): Promise<void> {
    try {
      const user = this.currentUser.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileURL = await this.uploadFile(chatId, file);
      
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      
      const content = type === 'image' ? '📷 Image' : `📎 ${file.name}`;

      const messagesRef = collection(this.firestore, `chats/${chatId}/messages`);
      
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || 'Unknown User',
        senderPhotoURL: user.photoURL || '',
        content: content,
        timestamp: serverTimestamp(),
        type: type,
        read: false,
        fileURL: fileURL,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };

      await addDoc(messagesRef, messageData);

      // Update chat's last message
      const chatRef = doc(this.firestore, `chats/${chatId}`);
      await updateDoc(chatRef, {
        lastMessage: content,
        lastMessageTime: serverTimestamp()
      });

    } catch (error) {
      console.error('Error sending file message:', error);
      throw error;
    }
  }

  private async uploadFile(chatId: string, file: File): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const filePath = `chat-files/${chatId}/${fileName}`;
    const storageRef = ref(this.storage, filePath);

    try {
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      const messagesRef = collection(this.firestore, `chats/${chatId}/messages`);
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
      
      const snapshot = await onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data['senderId'] !== userId && !data['read']) {
            updateDoc(doc.ref, { read: true });
          }
        });
      });

      setTimeout(() => snapshot(), 1000);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  getCurrentUser() {
    return this.currentUser.currentUser;
  }

  cleanup() {
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'File type not supported' };
    }

    return { valid: true };
  }
}
