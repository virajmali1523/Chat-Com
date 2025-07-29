import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';

import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';

import { CheckInboxComponent } from './pages/check-inbox/check-inbox.component';

import { ChatComponent } from './pages/chat/chat.component';

import { SidebarComponent } from './pages/chat/sidebar/sidebar.component';
import { ChatWindowComponent } from './pages/chat/chat-window/chat-window.component';
import { ChatListComponent } from './pages/chat/chat-list/chat-list.component';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';

import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    App,
    LoginComponent,
    RegisterComponent,
  
    CheckInboxComponent,
    ChatComponent,
    SidebarComponent,
    ChatWindowComponent,
    ChatListComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideAnalytics(() => getAnalytics())
  ],
  bootstrap: [App]
})
export class AppModule {}
