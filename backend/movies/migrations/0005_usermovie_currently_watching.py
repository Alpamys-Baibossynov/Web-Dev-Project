from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('movies', '0004_movie_media_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usermovie',
            name='status',
            field=models.CharField(
                choices=[
                    ('planned', 'Planned'),
                    ('currently_watching', 'Currently watching'),
                    ('watched', 'Watched'),
                    ('abandoned', 'Abandoned'),
                ],
                default='planned',
                max_length=20,
            ),
        ),
    ]
