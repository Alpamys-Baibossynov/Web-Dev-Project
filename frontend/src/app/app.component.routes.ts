import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { MovieDetailComponent } from './pages/movie-detail/movie-detail.component';
import { MyLibraryComponent } from './pages/my-library/my-library.component';
import { MoviesComponent } from './pages/movies/movies.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { RecommendationsComponent } from './pages/recommendations/recommendations.component';
import { RegisterComponent } from './pages/register/register.component';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'movies' },
  { path: 'movies', component: MoviesComponent, title: 'WatchList' },
  { path: 'movies/:mediaType/:id', component: MovieDetailComponent, title: 'Title Details' },
  { path: 'movies/:id', component: MovieDetailComponent, title: 'Movie Details' },
  { path: 'login', component: LoginComponent, title: 'Login' },
  { path: 'register', component: RegisterComponent, title: 'Register' },
  { path: 'my-list', component: MyLibraryComponent, canActivate: [authGuard], title: 'My list' },
  { path: 'recommendations', component: RecommendationsComponent, canActivate: [authGuard], title: 'Recommendations' },
  { path: 'my-library', pathMatch: 'full', redirectTo: 'my-list' },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard], title: 'Profile' },
  { path: 'users/:username', component: UserProfileComponent, title: 'User profile' },
  { path: '**', component: NotFoundComponent, title: 'Page Not Found' },
];
