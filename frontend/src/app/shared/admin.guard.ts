import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard = () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.currentUser();

    if (!user) {
        router.navigate(['/auth/login']);
        return false;
    }
    if (user.role !== 'admin') {
        router.navigate(['/']);
        return false;
    }
    return true;
};
