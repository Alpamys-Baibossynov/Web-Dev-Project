from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('movies', '0005_usermovie_currently_watching'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usermovie',
            name='mood',
            field=models.CharField(
                blank=True,
                choices=[
                    ('bored', 'Bored'),
                    ('excited', 'Excited'),
                    ('thoughtful', 'Thoughtful'),
                    ('calm', 'Calm'),
                    ('comforted', 'Calm'),
                    ('tense', 'Tense'),
                    ('sad', 'Sad'),
                    ('inspired', 'Inspired'),
                ],
                max_length=20,
            ),
        ),
    ]
