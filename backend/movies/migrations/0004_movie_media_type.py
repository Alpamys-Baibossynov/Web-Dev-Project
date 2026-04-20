from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('movies', '0003_usermovie_mood'),
    ]

    operations = [
        migrations.AddField(
            model_name='movie',
            name='media_type',
            field=models.CharField(
                choices=[('movie', 'Movie'), ('tv', 'TV Show')],
                default='movie',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='movie',
            name='tmdb_id',
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AddConstraint(
            model_name='movie',
            constraint=models.UniqueConstraint(fields=('tmdb_id', 'media_type'), name='unique_tmdb_media_item'),
        ),
    ]
