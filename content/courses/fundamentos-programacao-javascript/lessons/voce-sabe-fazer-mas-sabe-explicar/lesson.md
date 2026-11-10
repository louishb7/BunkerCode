# Você sabe fazer. Mas sabe explicar?

Na última lição, conversamos sobre como programar envolve muito mais do que escrever comandos em uma tela. Nesta, vou te apresentar um problema que, à primeira vista, qualquer pessoa saberia resolver.

Qualquer pessoa, menos o Otto.

E não é nada pessoal. O Otto só tem um pequeno problema: ele é uma máquina burra. Foi programado para seguir fielmente as instruções recebidas e consegue executá-las como ninguém. É tão bom em fazer o que foi pedido que vai fazer literalmente o que você pediu. Nem mais, nem menos. Hoje, você será responsável por dizer a ele o que fazer.

```bunker-note
{
  "kind": "info",
  "text": "**Otto**\n\nEu não sou uma máquina burra. Vocês, humanos, precisam ter mais certeza sobre o que querem."
}
```

Okay, Otto. Então, vamos começar com algo simples. Imagine que você precisa sair de casa e pede ao nosso novo ajudante que prepare sua mochila. Sobre a mesa estão um caderno, um estojo e uma garrafa de água. A mochila está aberta, pronta para receber os objetos.

Você provavelmente daria uma instrução parecida com esta:

"Coloque tudo que está na mesa dentro da mochila, feche com cuidado e deixe perto da porta."

Parece suficiente, não é? Vamos descobrir.

Nosso ajudante recebeu suas orientações e começou a trabalhar. Guardou o caderno, o estojo e a garrafa. Então fechou a mochila e a deixou perto da porta. Missão cumprida. Ou quase.

Acontece que a garrafa estava cheia de água, mas destampada. A tampa também estava sobre a mesa, e Otto (que não é uma máquina burra) simplesmente a guardou dentro da mochila, como todos os outros itens que estavam à disposição. A máquina guardou a garrafa exatamente como a encontrou, e agora temos uma mochila fechada, um caderno e a possibilidade de um pequeno desastre quando alguém resolver carregá-la.

```bunker-note
{
  "kind": "info",
  "text": "**Otto**\n\nVocê pediu para guardar a garrafa. Não pediu para fechá-la. Não me culpe por sua desatenção."
}
```

É... Tecnicamente, ele tem razão. E quero que você observe justamente isso: nosso ajudante não deixou de executar uma instrução. Ele fez aquilo que pedimos. O problema estava naquilo que esquecemos de dizer.

Você sabia que precisava tampar a garrafa antes de guardá-la. Provavelmente faria isso sem sequer pensar. Mas uma máquina que depende exclusivamente das orientações recebidas não pode contar com a dedução para preencher os detalhes que ficaram de fora. E, se não queremos uma mochila encharcada, precisamos melhorar nossas instruções.

Quando realizamos uma atividade conhecida, dificilmente precisamos pensar em cada pequeno movimento. Se alguém pede para você arrumar a mochila, não precisa explicar que uma garrafa destampada pode derramar água sobre os materiais. Você reconhece a situação e toma essa decisão naturalmente.

Na comunicação entre pessoas, contamos frequentemente com essa capacidade de compreender o contexto e completar informações que ficaram subentendidas. Mas nosso experimento funciona de outra maneira. O nosso ajudante não vai decidir por conta própria o que esquecemos de mencionar. Precisamos especificar as ações necessárias para que ele consiga realizar a tarefa como esperamos.

Então, vamos revisar as instruções:

1. Pegue a tampa que está sobre a mesa e tampe a garrafa.
2. Coloque o caderno, o estojo e a garrafa dentro da mochila.
3. Feche a mochila.
4. Deixe-a perto da porta.

Pronto. Não precisamos inventar uma solução extraordinária. Apenas identificamos uma ação importante que estava faltando.

Mas repare em outro detalhe: não adiantaria muito acrescentar a instrução de tampar a garrafa depois de fechar a mochila. Precisamos colocá-la no momento adequado. Isso acontece porque algumas ações dependem de outras para funcionar como esperamos. Pense na sequência que acabamos de construir. Primeiro, tampamos a garrafa. Depois, guardamos os materiais. Só então fechamos a mochila.

Agora imagine que trocássemos a ordem das instruções e pedíssemos ao Otto para fechar a mochila antes de guardar os objetos. Teríamos um problema: quando chegasse a hora de guardar os materiais, a mochila já estaria fechada. Percebe? As instruções podem estar corretas individualmente e, ainda assim, produzir um resultado errado quando executadas na ordem inadequada.

Na programação, essa ideia é muito importante. Quando construímos um programa, não basta determinar quais operações ele deve realizar. Também precisamos considerar em que sequência essas operações devem acontecer. Em muitos programas, uma instrução modifica a situação que a próxima encontrará. É como fechar a mochila: depois dessa ação, nosso ajudante já não encontra uma mochila aberta, mas uma mochila fechada.

Por outro lado, nem toda troca de ordem causa problemas. Poderíamos guardar o estojo antes do caderno e o resultado continuaria sendo o mesmo. O importante é reconhecer quando uma ação depende de outra e organizar as instruções para que tudo aconteça no momento certo. Não basta saber o que fazer. Precisamos pensar também no que deve acontecer antes e no que pode acontecer depois.

No dia seguinte, Otto recebeu outra tarefa. Desta vez, a mochila está fechada e precisamos guardar um caderno e um livro dentro dela.

Preparamos uma pequena sequência de instruções para nosso ajudante. Mas, em vez de escrevê-las como fizemos anteriormente, vamos representá-las em um bloco de código. Não se preocupe se nunca viu algo assim. Os nomes das ações foram inventados para nosso exemplo. Por enquanto, você não precisa entender a sintaxe nem fazer esse código funcionar. Observe apenas que cada linha representa uma ação e que, neste exemplo, Otto seguirá as instruções de cima para baixo, na ordem em que aparecem.

```
abrirMochila();
guardarCaderno();
guardarLivro();
fecharMochila();
```

Parece que está tudo pronto. Mas, antes de entregar as instruções ao Otto, percebemos que esquecemos um detalhe: o estojo também precisa ser guardado. Nosso ajudante ainda não começou a executar as ações. Portanto, podemos corrigir a sequência antes que ele comece.

Precisamos acrescentar uma nova instrução, guardarEstojo();, sem modificar as linhas que já existem. O problema é: onde podemos colocá-la para que a tarefa continue funcionando corretamente?

```bunker-quiz
{
  "id": "guardar-estojo-na-sequencia",
  "question": "Em qual posição podemos inserir a nova instrução para que a sequência continue funcionando corretamente?",
  "options": [
    {
      "id": "a",
      "text": "A instrução deve aparecer imediatamente antes de fecharMochila();, pois guardar o estojo precisa ser a última ação antes do fechamento.",
      "feedback": "Essa posição funcionaria, mas não é a única possível. Pense no que realmente precisa acontecer antes de guardar o estojo. Seria necessário guardar primeiro o caderno e o livro? A sequência permite mais de uma organização válida, desde que certas condições sejam respeitadas."
    },
    {
      "id": "b",
      "text": "A instrução pode aparecer em qualquer posição entre abrirMochila(); e fecharMochila();, independentemente da ordem em que os materiais sejam guardados.",
      "feedback": "Exatamente! Você percebeu que não existe uma única posição válida para a nova instrução.\n\nO importante é respeitar uma condição: a mochila precisa estar aberta quando o estojo for guardado. Podemos guardar o estojo antes ou depois do caderno e do livro. Nesse caso, a ordem entre os materiais não altera o resultado."
    },
    {
      "id": "c",
      "text": "A instrução pode aparecer depois de fecharMochila();, já que o estojo faz parte da mesma tarefa de organização.",
      "feedback": "As instruções pertencem à mesma tarefa, mas isso não significa que possam aparecer em qualquer ordem. Quando o ajudante chegar à nova instrução, a mochila já estará fechada. Para que a ação funcione sem modificar outras linhas, precisamos inseri-la enquanto a mochila estiver aberta."
    }
  ],
  "correct": "b"
}
```

Talvez você esteja se perguntando por que estamos gastando tanto tempo tentando ensinar uma máquina a arrumar uma mochila. Acontece que acabamos de praticar uma parte importante do raciocínio utilizado na programação.

Pense no que fizemos até aqui. Primeiro, encontramos um problema: Otto guardou uma garrafa destampada porque não recebeu a instrução de fechá-la. Depois, percebemos que não bastava acrescentar essa instrução em qualquer lugar. Ela precisava acontecer antes de guardar a garrafa.

Por fim, trabalhamos com uma sequência de código e descobrimos algo interessante: nem todas as ações precisam seguir uma única ordem possível. O estojo poderia ser guardado antes ou depois do livro. O que realmente importava era que a mochila estivesse aberta naquele momento.

Essas experiências mostram que organizar instruções não significa simplesmente colocar uma ação depois da outra. Precisamos considerar o que cada ação faz, quais condições são necessárias para executá-la e como ela pode afetar as próximas.

Quando escrevemos um programa, também precisamos representar aquilo que queremos que aconteça por meio de instruções. Um computador não conhece automaticamente nossas intenções. Ele realiza operações de acordo com as instruções e regras do programa que construímos. Se esquecermos uma operação necessária ou organizarmos certas ações de maneira inadequada, podemos obter um resultado diferente daquele que esperávamos. É por isso que aprender a programar também envolve desenvolver a capacidade de observar uma tarefa, reconhecer suas etapas e compreender como elas se relacionam.

Aliás, existe um nome para esse tipo de organização.

Na programação, chamamos de **algoritmo** um conjunto organizado de passos para realizar uma tarefa ou resolver um problema. E aqui está um detalhe importante: um algoritmo não precisa começar como código. Antes de escrever instruções em uma linguagem de programação, podemos pensar na solução, organizar as ações necessárias e verificar se fazem sentido. Foi justamente o que fizemos com ajuda do Otto.

Não se preocupe em decorar essa definição agora. Teremos bastante tempo para trabalhar com algoritmos durante esta trilha.   
Por enquanto, quero que você guarde uma ideia: **uma tarefa pode parecer óbvia para quem sabe realizá-la. O desafio está em transformar esse conhecimento em instruções claras e organizadas.**

Até aqui, t*rabalham*os com uma atividade relativamente pequena, mas e se nos depararmos com um obstáculo ainda maior?   
A resposta é muito simples:  **"Nenhum problema é tão grande que não dê pra dividir ele na porrada."**  
— Algum bêbado por aí.

Não se preocupe. Na próxima lição, aprenderemos **a arte de dividir problemas.**

```bunker-note
{
  "kind": "info",
  "text": "**Otto**\n\nResolver problemas? Sua arte tá mais para **criar problemas**."
}
```

É mesmo, Otto? Então advinha quem vai precisar resolver o problema da próxima lição...