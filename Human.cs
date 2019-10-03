using System;

namespace Human
{
    public class Human
    {
        // Fields 
        private int health;
        // Properties
        public string Name;
        public int Strength;
        public int Intelligence;
        public int Dexterity;
        public int Health
        {
            get
            {
                return this.health;
            }
            set
            {
                health = value;
            }
        }

        // Constructors
        public Human(string _name)
        {
            this.Name = _name;
            this.Strength = 3;
            this.Intelligence = 3;
            this.Dexterity = 3;
            this.Health = 100;
        }
        public Human(string _name = "Megaman",
                    int _strength = 5,
                    int _intelligence = 5,
                    int _dexterity = 5,
                    int _health = 200)
        {
            this.Name = _name;
            this.Strength = _strength;
            this.Intelligence = _intelligence;
            this.Dexterity = _dexterity;
            this.Health = _health;

            Console.WriteLine("Creating a megaman!");
        }

        // Methods
        public int Attack(Human target)
        {
            int damage = 0;
            // The damage done should be 5 * strength (5 points of damage to the attacked, for each 1 point of strength of the attacker). 
            // This method should return the remaining health of the target object.
            damage = 5 * this.Strength;
            target.Health = target.Health - damage;
            return target.Health;
        }
    }
}
