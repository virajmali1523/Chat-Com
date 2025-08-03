import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, NgZone } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Storage, ref, getDownloadURL } from '@angular/fire/storage';
import { ChatService, Chat, Message } from '../../../services/chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  standalone: false
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  @ViewChild('messageContainer') messageContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  selectedChat: Chat | null = null;
  messages: Message[] = [];
  newMessage = '';
  isLoading = false;
  isUploading = false;
  uploadProgress = 0;
  errorMessage = '';
  otherParticipantName = '';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private chatService = inject(ChatService);
  private ngZone = inject(NgZone);
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.subscriptions.push(
      this.chatService.selectedChat$.subscribe(chat => {
        this.selectedChat = chat;
        if (chat) {
          this.loadOtherParticipantName();
          this.markMessagesAsRead();
        } else {
          this.otherParticipantName = '';
        }
      })
    );

    this.subscriptions.push(
      this.chatService.messages$.subscribe(messages => {
        this.messages = messages;
        this.scrollToBottom();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getOtherParticipantName(): string {
    return this.otherParticipantName || 'Loading...';
  }

  trackByMessageId(index: number, message: Message): string {
    return message.id || index.toString();
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.auth.currentUser?.uid;
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  }

  isImageMessage(message: Message): boolean {
    return message.type === 'image';
  }

  isFileMessage(message: Message): boolean {
    return message.type === 'file';
  }

  openImageInNewTab(message: Message): void {
    if (message.fileURL) {
      window.open(message.fileURL, '_blank');
    }
  }

  formatFileSize(bytes: number): string {
    return this.chatService.formatFileSize(bytes);
  }

  getFileIcon(fileType: string): string {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('text')) return '📄';
    return '📎';
  }

  async downloadFile(message: Message): Promise<void> {
    if (!message.fileURL) return;

    try {
      const link = document.createElement('a');
      link.href = message.fileURL;
      link.download = message.fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      this.errorMessage = 'Failed to download file';
    }
  }

  openFileSelector(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (!file || !this.selectedChat) return;

    const validation = this.chatService.validateFile(file);
    if (!validation.valid) {
      this.errorMessage = validation.error || 'Invalid file';
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      
      const progressInterval = setInterval(() => {
        this.uploadProgress += 10;
        if (this.uploadProgress >= 90) {
          clearInterval(progressInterval);
        }
      }, 100);

      await this.chatService.sendFileMessage(this.selectedChat.chatId, file);
      
      clearInterval(progressInterval);
      this.uploadProgress = 100;
      
      setTimeout(() => {
        this.isUploading = false;
        this.uploadProgress = 0;
      }, 500);

      
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
      this.errorMessage = 'Failed to upload file';
      this.isUploading = false;
      this.uploadProgress = 0;
    }
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedChat || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.chatService.sendMessage(this.selectedChat.chatId, this.newMessage.trim())
      .then(() => {
        this.newMessage = '';
        this.isLoading = false;
      })
      .catch(error => {
        console.error('Error sending message:', error);
        this.errorMessage = 'Failed to send message';
        this.isLoading = false;
      });
  }

  sendMessageOnEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  private async markMessagesAsRead(): Promise<void> {
    if (!this.selectedChat || !this.auth.currentUser) return;
    
    try {
      await this.chatService.markMessagesAsRead(
        this.selectedChat.chatId, 
        this.auth.currentUser.uid
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  private async loadOtherParticipantName(): Promise<void> {
    if (!this.selectedChat || !this.auth.currentUser) {
      this.otherParticipantName = '';
      return;
    }
    
    const otherUserId = this.selectedChat.participants.find(
      uid => uid !== this.auth.currentUser!.uid
    );
    
    if (!otherUserId) {
      this.otherParticipantName = 'Unknown User';
      return;
    }

    try {
      const userDoc = doc(this.firestore, `users/${otherUserId}`);
      const userSnap = await getDoc(userDoc);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        this.otherParticipantName = userData['displayName'] || 'Unknown User';
      } else {
        this.otherParticipantName = 'Unknown User';
      }
    } catch (error) {
      console.error('Error loading user name:', error);
      this.otherParticipantName = 'Unknown User';
    }
  }
}
