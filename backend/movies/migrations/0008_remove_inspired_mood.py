from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('movies', '0007_add_scared_mood'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usermovie',
            name='mood',
            field=models.CharField(
                blank=True,
                choices=[
                    ('bored', 'Bored'),
                    ('scared', 'Scared'),
                    ('excited', 'Excited'),
                    ('thoughtful', 'Thoughtful'),
                    ('calm', 'Calm'),
                    ('comforted', 'Calm'),
                    ('tense', 'Tense'),
                    ('sad', 'Sad'),
                ],
                max_length=20,
            ),
        ),
    ]
