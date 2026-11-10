# O que significa programar?

Antes de começarmos, quero te apresentar uma ideia que vai acompanhar você durante todo este curso: programar não começa quando escrevemos a primeira linha de código. Existe uma habilidade que vem antes disso. Algo que não aparece na tela, não depende de uma linguagem e nem sempre é percebido por quem está começando. É a capacidade de observar um problema, compreender o que está acontecendo e pensar em maneiras de resolvê-lo.

O que vamos construir neste primeiro módulo é uma tentativa de te entregar um **conhecimento invisível**: uma lente diferente para observar problemas. Quando você começa a enxergar a estrutura por trás de uma decisão ou de uma regra, fica mais fácil perceber por que certas soluções funcionam e outras desmoronam na primeira exceção. Você para de aceitar explicações vagas e passa a examinar como as coisas realmente operam.

Vamos começar com uma afirmativa muito simples: **nosso cérebro é uma ferramenta poderosa!** 

Pense bem... como você acha que a memória funciona?

```bunker-note
{
  "kind": "info",
  "text": "Faça um teste rápido de cinco segundos: o que é uma oração subordinada? E qual era mesmo a fórmula de Bhaskara que você passou anos estudando na escola?"
}
```

É! Já pensou em quão difícil seria ter que conviver com toda essa bagagem de conhecimento? De abrir o seu “banco de dados” e ter que lembrar exatamente de todas as fórmulas matemáticas que você estudou na escola? De todas as regras de português? A gente enlouqueceria com tanta informação.

Como esta não é uma aula de biologia, irei resumir a um único conselho inicial: **não se preocupe em decorar a sintaxe da primeira linguagem de programação que você irá estudar**.

Quem vê a programação de fora costuma imaginar que programar consiste em decorar centenas de palavras em inglês e símbolos especiais para digitar sem parar numa tela escura. Por causa dessa impressão, muita gente trava logo no início: tenta memorizar comandos soltos, esquece um detalhe, recebe um erro na tela e conclui que não leva jeito para a área. O problema é que aprender a gramática de uma linguagem e aprender a resolver problemas são atividades diferentes.

Eventualmente, a sintaxe irá se enraizar na sua cabeça. Mas não tenha pressa. Até hoje, quando se trata de estudar programação, eu ainda me jogo na cama enquanto falo pra mim mesmo: *"Meu deus! eu sou a pessoa mais burra do mundo!"*

E então, 30 minutos depois, a pessoa mais burra do mundo consegue resolver o problema que a estressou até o talo.

## A programação não começa no teclado

Repare no detalhe dessa cena: o problema não foi resolvido enquanto eu encarava a tela tentando lembrar qual comando digitar, mas quando saí da frente do computador e reorganizei a ideia na cabeça.

Programar não começa no instante em que você abre um editor de texto para digitar código, mas também não funciona como uma linha de montagem rígida onde você planeja tudo na cabeça para só escrever código no último minuto. Na prática, nós pensamos no problema, escrevemos um rascunho de solução, colocamos para rodar, observamos onde nossas suposições falharam e voltamos para ajustar o raciocínio.

Mas existe um detalhe traiçoeiro nesse processo: muitas vezes, aquilo que parece perfeitamente resolvido na nossa cabeça ainda está cheio de perguntas que sequer percebemos que precisavam ser feitas. E não, isso não significa que você tenha algum problema de raciocínio. Na verdade, é quase o contrário.

## O conforto do piloto automático

Pense em quantas coisas você faz diariamente sem precisar refletir sobre cada pequena etapa. Quando sai de casa, por exemplo, provavelmente não precisa recitar uma sequência de instruções para lembrar de pegar a chave, fechar a porta e conferir se ela ficou trancada. Você simplesmente faz. Nosso cérebro é especialmente eficiente em transformar atividades recorrentes em hábitos. Isso permite que você se concentre em outras coisas enquanto executa tarefas que já conhece.

Na comunicação entre pessoas, acontece algo parecido. Não precisamos detalhar absolutamente tudo o que dizemos, porque contamos com a capacidade da outra pessoa de interpretar o contexto, reconhecer nossas intenções e preencher o que ficou subentendido. E sim, estou contando com essa mesma capacidade enquanto atiro um monte de informações e afirmações na sua cabeça. Se precisasse explicar absolutamente tudo o que deixo subentendido, provavelmente ainda estaríamos no primeiro parágrafo.

O problema começa quando levamos esse mesmo hábito para a programação. Vou te mostrar por quê. Imagine que você esteja me ajudando a desenvolver esta própria plataforma de estudos e eu te entregue a seguinte tarefa:

*"Quando o aluno terminar uma lição, libere a próxima."*

Simples, não é? Você entendeu o que eu quero. Eu sei o que estou pedindo. Podemos até concordar que essa funcionalidade faz todo o sentido.

Mas quero que você observe uma palavra específica nessa frase: **terminar**. O que exatamente significa terminar uma lição?

- O aluno precisa ler todo o conteúdo?
- Basta chegar ao final da página?
- Ele precisa responder corretamente a algum exercício?

Percebeu? Nossa tarefa, que antes cabia confortavelmente em uma única frase, começou a revelar uma série de decisões que ainda não tomamos.

Isso acontece porque, quando conversamos, somos capazes de compreender uma intenção geral sem necessariamente conhecer todos os detalhes envolvidos na sua execução. Mas compreender o que alguém deseja não é a mesma coisa que saber exatamente como construir aquilo.

E, ironicamente, como você ainda não está me ajudando diretamente a desenvolver esta plataforma, sou eu quem precisa responder às perguntas que acabei de apresentar. Inclusive, essa foi uma das minhas primeiras descobertas ao desenvolver projetos próprios: quando você trabalha sozinho, também precisa aprender a questionar as instruções que você mesmo inventou.

Por isso, eu sugiro que você não trabalhe sozinho. Minha recomendação é que você contrate para te auxiliar: **as vozes da sua cabeça**, **os demônios da autossabotagem**, **e o ego de conseguir resolver qualquer problema que aparecer futuramente.** 

Aviso: nem sempre os membros da equipe chegam a um consenso.

Talvez você nem saiba por onde começar a resolver, mas e daí? Primeiro você dá uma mordida no bolo, e só depois descobre se consegue ou não engolir o pedaço.

## Tirando as regras da nossa cabeça

Vamos continuar com o nosso exemplo. Imagine que, depois de discutir algumas possibilidades, decidimos estabelecer os seguintes critérios para essa funcionalidade:

1. Cada lição possui um pequeno exercício com três perguntas.
2. Para concluir a lição, o aluno precisa acertar pelo menos duas.
3. Quando atingir esse resultado, a lição será marcada como concluída e a próxima será liberada.
4. Caso contrário, ele poderá tentar novamente.

Essas regras não são necessariamente as melhores para uma plataforma de estudos. Poderíamos escolher critérios completamente diferentes. O importante é que, agora, começamos a transformar uma intenção subjetiva em comportamentos que conseguimos observar e verificar.

Antes, tínhamos uma frase: *"Quando o aluno terminar uma lição, libere a próxima."* Agora, conseguimos responder a perguntas concretas. Se alguém acertar apenas uma questão, deve avançar? Não. E se acertar duas? Sim. E se errar todas? Poderá fazer outra tentativa.

Observe que não precisamos decorar um único comando de JavaScript para chegar até aqui. Estamos investigando o problema e estabelecendo as regras que precisaremos representar posteriormente.

Aliás, quer ver uma coisa interessante? Vou pegar uma parte das decisões que acabamos de tomar e representá-la utilizando JavaScript. Não se assuste:

```javascript
let proximaLicaoLiberada = false;

const acertos = 2;

if (acertos >= 2) {
  proximaLicaoLiberada = true;
} else {
  console.log("Tente novamente.");
}
```

Pronto. Se você acabou de olhar para esse monte de símbolos e pensou que não entendeu absolutamente nada, ótimo. Ainda não era para entender a sintaxe.

Mas quero que observe uma coisa: embora o código tenha uma aparência diferente, a decisão que ele representa não deveria ser uma novidade para você. Estamos apenas verificando quantas questões foram respondidas corretamente. Se o aluno acertou pelo menos duas, a próxima lição pode ser liberada. Caso contrário, ele recebe uma mensagem informando que pode tentar novamente.

É apenas um pequeno recorte ilustrativo, não a implementação completa da funcionalidade. O JavaScript nos oferece uma maneira de representar e executar essa decisão. Aos poucos, vamos aprender o que significam essas palavras, símbolos e estruturas. Por enquanto, o importante é perceber que **a ideia existia antes de precisarmos escrevê-la em código**.

E, já que aparentemente estamos desenvolvendo uma plataforma juntos, quero te propor um pequeno desafio.

```bunker-quiz
{
  "id": "quiz-c170cb23-d58f-4efd-b0ed-2acad7ddc8d3",
  "question": "O aluno acertou duas das três questões e conseguiu desbloquear a próxima lição. Entretanto, ao atualizar a página, perdeu o acesso. Qual das alternativas representa a atitude mais adequada diante desse problema?",
  "options": [
    {
      "id": "a",
      "text": "Jogar tudo para o alto. Claramente, computadores foram inventados para testar os limites da paciência humana.",
      "feedback": "A vontade de desistir é compreensível, mas ainda não precisamos declarar guerra ao computador.\n\nO desbloqueio funcionou inicialmente. Precisamos descobrir por que deixou de funcionar após a atualização."
    },
    {
      "id": "b",
      "text": "Reescrever toda a funcionalidade do zero. Se alguma coisa falhou, significa que nossa primeira solução estava completamente errada.",
      "feedback": "Calma! Não precisamos jogar fora tudo o que já construímos.\n\nA funcionalidade chegou a desbloquear a próxima lição. Antes de refazer o trabalho, precisamos entender o que falhou."
    },
    {
      "id": "option-a812f45d-a1e4-47c1-85d5-0e0cb0bdd4a7",
      "text": "Investigar se a conclusão da lição foi registrada corretamente, pois o aluno perdeu o registro ao atualizar a página.",
      "feedback": "Exatamente! O aluno conseguiu desbloquear a lição, mas perdeu o acesso ao atualizar a página.\n\nIsso nos dá uma pista importante: o problema apareceu depois da atualização.  "
    }
  ],
  "correct": "option-a812f45d-a1e4-47c1-85d5-0e0cb0bdd4a7"
}
```

---

Você acabou de acompanhar uma parte importante do trabalho de quem programa. Começamos com uma necessidade, investigamos o que ela significava, estabelecemos algumas regras e imaginamos uma solução. O código não é uma espécie de resposta definitiva que escrevemos depois de pensar em tudo. Ele também é uma ferramenta que utilizamos para experimentar, investigar e aperfeiçoar nossas soluções.

## Então, o que significa programar?

Agora podemos voltar à pergunta que dá nome a esta lição. Programar é o processo de compreender um problema, desenvolver uma solução, representá-la por meio de instruções que possam ser executadas e verificar se o comportamento produzido corresponde ao resultado que pretendíamos alcançar. Repare que escrever código faz parte desse processo, mas não representa tudo o que ele envolve.

Ao longo do curso, vamos utilizar o **JavaScript** para transformar nossas ideias em programas executáveis. Você conhecerá suas regras, aprenderá a escrever instruções e descobrirá como utilizar os recursos que a linguagem oferece.

Mas quero que guarde uma coisa antes de chegarmos lá: nenhuma linguagem de programação consegue decidir por você o que significa *terminar uma lição*, *ser um cliente frequente* ou *ter cumprido uma meta*. Essas são perguntas sobre o problema que estamos tentando resolver. A linguagem nos oferece ferramentas para representar as decisões que tomamos. E é justamente por isso que não começaremos decorando comandos.

Na próxima lição, quero te apresentar um problema que, à primeira vista, qualquer pessoa saberia resolver. A dificuldade? Você terá que descobrir como explicar a solução para alguém que não pode contar com o seu bom senso, não conhece suas intenções e não tem como adivinhar o que você esqueceu de dizer.

Talvez você descubra que o problema não era tão simples quanto parecia.

Bom, como você não participou da reunião de desenvolvimento desta plataforma, tomei a liberdade de decidir sozinho o significado de "Terminar uma lição". Nesta primeira tarefa, resolvi simplificar. Você chegou até aqui? Então pode seguir para a próxima lição.

Eu escolhi não complicar as coisas. Pelo menos não na introdução.