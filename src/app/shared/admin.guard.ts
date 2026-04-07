import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // currentUser() ya se hidrata sincrónicamente desde localStorage,
    // por lo que no hay race condition al recargar la página en /admin.
    const user = auth.currentUser();

    if (!user || !auth.getToken()) {
        router.navigate(['/auth/login']);
        return false;
    }
    if (user.role !== 'admin') {
        router.navigate(['/']);
        return false;
    }
    return true;
};
