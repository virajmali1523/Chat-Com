import { Component } from '@angular/core';
import { Auth, onAuthStateChanged, reload, User } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-check-inbox',
  standalone: false,
  templateUrl: './check-inbox.component.html',
  styleUrls: ['./check-inbox.component.scss']
})
export class CheckInboxComponent {
  email: string | null = null;
  isVerified: boolean = false;
  loading: boolean = true;
  user: User | null = null;

  constructor(private auth: Auth, private router: Router) {
    this.watchAuthState();
  }

  watchAuthState() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.user = user;
        this.email = user.email;

        await reload(user); 
        this.isVerified = user.emailVerified;

        if (this.isVerified) {
          
          this.router.navigate(['/login']);
        }
      }
      this.loading = false;
    });
  }

  async refreshStatus() {
    if (this.user) {
      await reload(this.user);
      this.isVerified = this.user.emailVerified;

      if (this.isVerified) {
        alert('Email verified! Please sign in again.');
       
        this.router.navigate(['/login']);
      } else {
        alert('Email not verified yet. Please check your inbox again.');
      }
    }
  }
}
