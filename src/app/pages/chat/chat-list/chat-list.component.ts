import { Component, OnInit, inject, NgZone } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { ChatService, Chat } from '../../../services/chat.service';

@Component({
  selector: 'app-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss'],
  standalone: false
})
export class ChatListComponent implements OnInit {
  chatList: any[] = [];
  defaultProfilePic = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

  currentUserId: string = '';
  searchQuery = '';
  searchResults: any[] = [];
  noUserFound = false;
  searchType: 'name' | 'email' | 'uid' = 'name';
  errorMessage = '';

  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private chatService = inject(ChatService);
  private ngZone = inject(NgZone);

  ngOnInit(): void {
    const user = this.auth.currentUser;
    if (!user) return;

    this.currentUserId = user.uid;
    this.listenForChats();
  }

  async listenForChats() {
    try {
      await this.ngZone.runGuarded(async () => {
        const chatsRef = collection(this.firestore, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', this.currentUserId));
        const snap = await getDocs(q);

        this.ngZone.run(() => {
          this.chatList = [];
        });

        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const otherUserId = data['participants'].find((uid: string) => uid !== this.currentUserId);
          const userRef = doc(this.firestore, `users/${otherUserId}`);
          
          onSnapshot(userRef, (userSnap) => {
            const userData = userSnap.data();
            this.ngZone.run(() => {
              const chatData = {
                chatId: docSnap.id,
                participants: data['participants'],
                displayName: userData?.['displayName'] || 'Unknown',
                photoURL: userData?.['photoURL'] || '',
                lastMessage: data['lastMessage'] || '',
                lastMessageTime: data['lastMessageTime']
              };
              
              const existingIndex = this.chatList.findIndex(chat => chat.chatId === docSnap.id);
              if (existingIndex >= 0) {
                this.chatList[existingIndex] = chatData;
              } else {
                this.chatList.push(chatData);
              }
            });
          });
        });
      });
    } catch (error) {
      console.error('Error listening for chats:', error);
    }
  }

  selectChat(chat: any) {
    console.log('Selected Chat:', chat);
    const chatData: Chat = {
      chatId: chat.chatId,
      participants: chat.participants,
      lastMessage: chat.lastMessage,
      lastMessageTime: chat.lastMessageTime
    };
    this.chatService.setSelectedChat(chatData);
  }

  async searchUsers() {
    if (!this.searchQuery.trim() || this.searchQuery.trim().length < 2) {
      this.ngZone.run(() => {
        this.searchResults = [];
        this.noUserFound = false;
      });
      return;
    }

    try {
      this.ngZone.run(() => {
        this.searchResults = [];
        this.noUserFound = false;
      });

      await this.ngZone.runGuarded(async () => {
        const usersRef = collection(this.firestore, 'users');
        let q;

        switch (this.searchType) {
          case 'name':
            const searchQueryLower = this.searchQuery.toLowerCase();
            q = query(
              usersRef,
              where('displayNameLower', '>=', searchQueryLower),
              where('displayNameLower', '<=', searchQueryLower + '\uf8ff')
            );
            break;

          case 'email':
            q = query(usersRef, where('email', '==', this.searchQuery));
            break;

          case 'uid':
            q = query(usersRef, where('uid', '==', this.searchQuery));
            break;

          default:
            q = query(usersRef, where('displayName', '==', this.searchQuery));
        }

        const snap = await getDocs(q);

        this.ngZone.run(() => {
          if (snap.empty) {
            this.noUserFound = true;
          } else {
            snap.forEach(docSnap => {
              const data = docSnap.data();
              if (docSnap.id !== this.currentUserId) {
                this.searchResults.push({ 
                  uid: docSnap.id, 
                  ...data,
                  displayName: data['displayName'] || 'Unknown User',
                  photoURL: data['photoURL'] || this.defaultProfilePic
                });
              }
            });
          }
        });
      });
    } catch (error) {
      console.error('Error searching users:', error);
      this.ngZone.run(() => {
        this.errorMessage = 'Search failed. Please try again.';
      });
    }
  }

  onSearchInput() {
    if (!this.searchQuery.trim() || this.searchQuery.trim().length < 2) {
      this.ngZone.run(() => {
        this.searchResults = [];
        this.noUserFound = false;
      });
      return;
    }
    this.searchUsers();
  }

  onSearchTypeChange() {
    if (this.searchQuery.trim().length >= 2) {
      this.ngZone.run(() => {
        this.searchUsers();
      });
    }
  }

  async startChatWithUser(user: any) {
    try {
      await this.ngZone.runGuarded(async () => {
        const chatsRef = collection(this.firestore, 'chats');

        const q = query(chatsRef, where('participants', 'in', [
          [this.currentUserId, user.uid],
          [user.uid, this.currentUserId]
        ]));
        const existingSnap = await getDocs(q);

        let chatId: string;

        if (existingSnap.empty) {
          chatId = `${this.currentUserId}_${user.uid}`;
          await setDoc(doc(this.firestore, 'chats', chatId), {
            participants: [this.currentUserId, user.uid],
            lastMessage: '',
            lastMessageTime: null
          });
        } else {
          chatId = existingSnap.docs[0].id;
        }

        const chatData: Chat = {
          chatId: chatId,
          participants: [this.currentUserId, user.uid]
        };

        this.ngZone.run(() => {
          this.chatList.unshift({
            chatId: chatId,
            participants: [this.currentUserId, user.uid],
            displayName: user.displayName,
            photoURL: user.photoURL || '',
            lastMessage: ''
          });

          this.searchQuery = '';
          this.searchResults = [];
          this.selectChat(chatData);
        });
      });
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  }

  getSearchTypeDisplayName(): string {
    switch (this.searchType) {
      case 'name': return 'Name';
      case 'email': return 'Email';
      case 'uid': return 'User ID';
      default: return 'Name';
    }
  }
}
