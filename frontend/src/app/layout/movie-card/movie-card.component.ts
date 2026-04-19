import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MovieListItem } from '../../models/movie-list-item.interface';

@Component({
  selector: 'app-movie-card',
  imports: [RouterModule],
  templateUrl: './movie-card.component.html',
  styleUrl: './movie-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieCardComponent {
  @Input({ required: true}) movie!: MovieListItem;
}
