import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, createUserWithEmailAndPassword, sendEmailVerification } from '@angular/fire/auth';
import { inject } from '@angular/core';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: false
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';

  private auth: Auth = inject(Auth);

  constructor(private router: Router) {}

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.name || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }
    if (!this.email.includes('@') || !this.email.includes('.')) {
      this.errorMessage = 'Invalid email format.';
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    createUserWithEmailAndPassword(this.auth, this.email, this.password)
      .then(userCredential => {
        const user = userCredential.user;
        return sendEmailVerification(user)
          .then(() => {
            this.successMessage = 'Registration successful! Verification email sent.';
            this.router.navigate(['/check-inbox']);
          });
      })
      .catch(error => {
        console.error('Firebase Error:', error);
        if (error.code === 'auth/email-already-in-use') {
          this.errorMessage = 'This email is already registered. Please log in.';
        } else {
          this.errorMessage = error.message || 'Registration failed.';
        }
      });
  }
}
