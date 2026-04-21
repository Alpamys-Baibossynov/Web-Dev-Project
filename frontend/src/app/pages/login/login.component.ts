import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly form = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  error: string | null = null;
  isSubmitting = false;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.error = null;

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl('/my-list');
      },
      error: () => {
        this.error = 'Login failed, check your username and password';
        this.isSubmitting = false;
      },
    });
  }
}
