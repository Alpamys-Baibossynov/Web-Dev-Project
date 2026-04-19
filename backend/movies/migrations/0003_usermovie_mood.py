from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('movies', '0002_movie_tmdb_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='usermovie',
            name='mood',
            field=models.CharField(
                blank=True,
                choices=[
                    ('excited', 'Excited'),
                    ('thoughtful', 'Thoughtful'),
                    ('comforted', 'Comforted'),
                    ('tense', 'Tense'),
                    ('sad', 'Sad'),
                    ('inspired', 'Inspired'),
                ],
                max_length=20,
            ),
        ),
    ]
