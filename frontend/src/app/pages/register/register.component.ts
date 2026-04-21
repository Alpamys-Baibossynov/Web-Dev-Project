import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly form = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
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

    this.authService.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl('/my-list');
      },
      error: () => {
        this.error = 'Registration failed, please check the form';
        this.isSubmitting = false;
      },
    });
  }
}
