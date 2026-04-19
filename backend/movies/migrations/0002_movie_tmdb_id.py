from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('movies', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='movie',
            name='tmdb_id',
            field=models.PositiveIntegerField(blank=True, null=True, unique=True),
        ),
    ]
