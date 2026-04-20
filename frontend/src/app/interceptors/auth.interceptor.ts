import { HttpInterceptorFn } from '@angular/common/http';


export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('watchlist.token');
  const isPublicRequest =
    req.url.includes('/api/movies/')
    || req.url.includes('/api/genres/')
    || req.url.includes('/api/auth/login/')
    || req.url.includes('/api/auth/register/')
    || (req.url.includes('/api/auth/users/') && !req.url.includes('/follow/'));

  if (!token || isPublicRequest) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Token ${token}`,
      },
    }),
  );
};
