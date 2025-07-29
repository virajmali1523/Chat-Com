import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { inject } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';

  private auth: Auth = inject(Auth);

  constructor(private router: Router) {}

  onLogin() {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Fill in both email and password.';
      return;
    }

    signInWithEmailAndPassword(this.auth, this.email, this.password)
      .then(() => this.router.navigate(['/chat']))
      .catch(error => {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
          this.errorMessage = 'Email not registered. Please sign up.';
        } else if (error.code === 'auth/wrong-password') {
          this.errorMessage = 'Incorrect password.';
        } else {
          this.errorMessage = error.message || 'Login failed.';
        }
      });
  }
}
