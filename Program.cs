using System;

namespace Human
{
    class Program
    {
        static void Main(string[] args)
        {
            Human Canelo = new Human("Canelo", 9, 9, 9, 400);
            Human GGG = new Human("GGG", 7, 8, 9, 500);

            Console.WriteLine( Canelo.Attack(GGG));
            Console.WriteLine(GGG.Attack(Canelo));
            Console.WriteLine(Canelo.Attack(GGG));
            Console.WriteLine(Canelo.Attack(GGG));

            if(Canelo.Health > GGG.Health) Console.WriteLine(" Canelo is the winner!!");
            else if (Canelo.Health < GGG.Health) Console.WriteLine(" GGG is the winner!!");
            else if (Canelo.Health == GGG.Health) Console.WriteLine(" it's a draw!!");
        }
    }
    
}
